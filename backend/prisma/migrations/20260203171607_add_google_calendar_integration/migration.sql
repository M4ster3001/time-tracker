-- CreateTable
CREATE TABLE `google_calendar_connections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `accessTokenEnc` TEXT NOT NULL,
    `refreshTokenEnc` TEXT NOT NULL,
    `tokenExpiresAt` DATETIME(3) NOT NULL,
    `calendarEmail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `google_calendar_connections_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `google_calendar_imports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `googleEventId` VARCHAR(191) NOT NULL,
    `timeEntryId` INTEGER NOT NULL,
    `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `google_calendar_imports_timeEntryId_key`(`timeEntryId`),
    INDEX `google_calendar_imports_userId_idx`(`userId`),
    UNIQUE INDEX `google_calendar_imports_userId_googleEventId_key`(`userId`, `googleEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `google_calendar_connections` ADD CONSTRAINT `google_calendar_connections_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `google_calendar_imports` ADD CONSTRAINT `google_calendar_imports_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `google_calendar_imports` ADD CONSTRAINT `google_calendar_imports_timeEntryId_fkey` FOREIGN KEY (`timeEntryId`) REFERENCES `time_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
