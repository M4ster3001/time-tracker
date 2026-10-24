-- The historical 20260209112751 migration was empty. Some installations used
-- db push to create these tables. Preserve such tables and repair fresh installs.
CREATE TABLE IF NOT EXISTS `temporary_unlocks` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `clientId` INTEGER NOT NULL,
  `grantedBy` INTEGER NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `reason` TEXT NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `temporary_unlocks_userId_clientId_idx` (`userId`, `clientId`),
  INDEX `temporary_unlocks_expiresAt_idx` (`expiresAt`),
  INDEX `temporary_unlocks_userId_clientId_periodYear_periodMonth_idx` (`userId`, `clientId`, `periodYear`, `periodMonth`),
  CONSTRAINT `temporary_unlocks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `temporary_unlocks_grantedBy_fkey` FOREIGN KEY (`grantedBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `temporary_unlocks_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `temporary_unlock_edits` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `temporaryUnlockId` INTEGER NOT NULL,
  `timeEntryId` INTEGER NULL,
  `action` VARCHAR(191) NOT NULL,
  `previousData` JSON NULL,
  `newData` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `temporary_unlock_edits_temporaryUnlockId_idx` (`temporaryUnlockId`),
  CONSTRAINT `temporary_unlock_edits_temporaryUnlockId_fkey` FOREIGN KEY (`temporaryUnlockId`) REFERENCES `temporary_unlocks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
