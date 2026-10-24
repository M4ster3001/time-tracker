-- Sync foundation: uuid estavel por linha + tombstone em time_entries.
-- Backfill em 3 passos (nullable -> preenche -> NOT NULL + unique) para nao
-- quebrar nas linhas ja existentes.

-- users.uuid
ALTER TABLE `users` ADD COLUMN `uuid` VARCHAR(36) NULL;
UPDATE `users` SET `uuid` = (UUID()) WHERE `uuid` IS NULL;
ALTER TABLE `users` MODIFY `uuid` VARCHAR(36) NOT NULL;
CREATE UNIQUE INDEX `users_uuid_key` ON `users`(`uuid`);

-- clients.uuid
ALTER TABLE `clients` ADD COLUMN `uuid` VARCHAR(36) NULL;
UPDATE `clients` SET `uuid` = (UUID()) WHERE `uuid` IS NULL;
ALTER TABLE `clients` MODIFY `uuid` VARCHAR(36) NOT NULL;
CREATE UNIQUE INDEX `clients_uuid_key` ON `clients`(`uuid`);

-- time_entries.uuid + deletedAt
ALTER TABLE `time_entries` ADD COLUMN `uuid` VARCHAR(36) NULL;
UPDATE `time_entries` SET `uuid` = (UUID()) WHERE `uuid` IS NULL;
ALTER TABLE `time_entries` MODIFY `uuid` VARCHAR(36) NOT NULL;
CREATE UNIQUE INDEX `time_entries_uuid_key` ON `time_entries`(`uuid`);

ALTER TABLE `time_entries` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `time_entries_updatedAt_idx` ON `time_entries`(`updatedAt`);
