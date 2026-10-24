-- CreateTable
CREATE TABLE `smtp_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 587,
    `secure` BOOLEAN NOT NULL DEFAULT false,
    `user` VARCHAR(191) NOT NULL,
    `passwordEnc` TEXT NOT NULL,
    `fromName` VARCHAR(191) NULL,
    `fromEmail` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_dispatches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `smtpConfigId` INTEGER NOT NULL,
    `recipientsJson` TEXT NOT NULL,
    `clientIdsJson` TEXT NOT NULL,
    `frequency` VARCHAR(20) NOT NULL,
    `weekDay` INTEGER NULL,
    `monthDay` INTEGER NULL,
    `hour` INTEGER NOT NULL,
    `minute` INTEGER NOT NULL,
    `reportFormat` VARCHAR(20) NOT NULL,
    `reportPeriod` VARCHAR(20) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `nextRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `email_dispatches_isActive_nextRunAt_idx`(`isActive`, `nextRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_dispatch_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dispatchId` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `recipientsJson` TEXT NOT NULL,
    `clientIdsJson` TEXT NOT NULL,
    `reportPeriod` VARCHAR(10) NOT NULL,
    `errorMessage` TEXT NULL,
    `filesSent` INTEGER NOT NULL DEFAULT 0,
    `triggeredBy` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_dispatch_logs_dispatchId_idx`(`dispatchId`),
    INDEX `email_dispatch_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_dispatches` ADD CONSTRAINT `email_dispatches_smtpConfigId_fkey` FOREIGN KEY (`smtpConfigId`) REFERENCES `smtp_configs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_dispatch_logs` ADD CONSTRAINT `email_dispatch_logs_dispatchId_fkey` FOREIGN KEY (`dispatchId`) REFERENCES `email_dispatches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
