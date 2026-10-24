-- CreateTable
CREATE TABLE `closing_periods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `state` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 0,
    `publishedVersion` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `closing_periods_clientId_startDate_endDate_idx`(`clientId`, `startDate`, `endDate`),
    UNIQUE INDEX `closing_periods_clientId_year_month_key`(`clientId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `closing_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `periodId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `snapshotJson` LONGTEXT NOT NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `reason` TEXT NOT NULL,
    `createdBy` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedBy` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `closing_revisions_periodId_version_key`(`periodId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hour_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerKey` VARCHAR(100) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `clientId` INTEGER NULL,
    `allowNegative` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `hour_accounts_ownerKey_key`(`ownerKey`),
    INDEX `hour_accounts_userId_idx`(`userId`),
    INDEX `hour_accounts_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hour_movements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accountId` INTEGER NOT NULL,
    `deltaMinutes` INTEGER NOT NULL,
    `kind` VARCHAR(24) NOT NULL,
    `sourceKey` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `createdBy` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `expiresCreditId` INTEGER NULL,
    `reversesId` INTEGER NULL,
    `parentId` INTEGER NULL,
    `relatedAccountId` INTEGER NULL,

    UNIQUE INDEX `hour_movements_sourceKey_key`(`sourceKey`),
    UNIQUE INDEX `hour_movements_reversesId_key`(`reversesId`),
    INDEX `hour_movements_accountId_createdAt_id_idx`(`accountId`, `createdAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `closing_periods` ADD CONSTRAINT `closing_periods_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `closing_revisions` ADD CONSTRAINT `closing_revisions_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `closing_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hour_accounts` ADD CONSTRAINT `hour_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hour_accounts` ADD CONSTRAINT `hour_accounts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hour_movements` ADD CONSTRAINT `hour_movements_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `hour_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hour_movements` ADD CONSTRAINT `hour_movements_expiresCreditId_fkey` FOREIGN KEY (`expiresCreditId`) REFERENCES `hour_movements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hour_movements` ADD CONSTRAINT `hour_movements_reversesId_fkey` FOREIGN KEY (`reversesId`) REFERENCES `hour_movements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
