CREATE TABLE `quick_log_patterns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `clientId` INTEGER NULL,
    `clientScopeKey` VARCHAR(191) NOT NULL,
    `activityKey` VARCHAR(191) NOT NULL,
    `activityLabel` VARCHAR(191) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `qlp_user_scope_activity_duration_key`(`userId`, `clientScopeKey`, `activityKey`, `durationMinutes`),
    INDEX `qlp_user_scope_activity_idx`(`userId`, `clientScopeKey`, `activityKey`),
    INDEX `qlp_user_last_used_idx`(`userId`, `lastUsedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quick_log_patterns`
  ADD CONSTRAINT `quick_log_patterns_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `quick_log_patterns_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
