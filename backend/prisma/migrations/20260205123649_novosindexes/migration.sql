-- AlterTable
ALTER TABLE `clients` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` INTEGER NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` INTEGER NULL;

-- CreateIndex
CREATE INDEX `clients_deletedAt_idx` ON `clients`(`deletedAt`);

-- CreateIndex
CREATE INDEX `users_deletedAt_idx` ON `users`(`deletedAt`);
