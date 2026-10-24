ALTER TABLE `users`
  ADD COLUMN `accessMode` VARCHAR(16) NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN `locale` VARCHAR(16) NOT NULL DEFAULT 'pt-BR';
ALTER TABLE `personal_access_tokens` ADD COLUMN `grantsJson` TEXT NULL;
CREATE TABLE `access_groups` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL DEFAULT '',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `access_groups_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `access_grants` (
  `groupId` INTEGER NOT NULL, `permission` VARCHAR(80) NOT NULL, `scope` VARCHAR(16) NOT NULL,
  PRIMARY KEY (`groupId`, `permission`, `scope`),
  CONSTRAINT `access_grants_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `access_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `access_memberships` (
  `userId` INTEGER NOT NULL, `groupId` INTEGER NOT NULL,
  PRIMARY KEY (`userId`, `groupId`), INDEX `access_memberships_groupId_idx` (`groupId`),
  CONSTRAINT `access_memberships_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `access_memberships_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `access_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `feature_settings` (
  `key` VARCHAR(80) NOT NULL, `enabled` BOOLEAN NOT NULL,
  `updatedBy` INTEGER NULL, `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
