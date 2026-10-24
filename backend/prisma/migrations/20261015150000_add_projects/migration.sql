-- PRJ-01: projetos por cliente + vinculo opcional em time_entries.
ALTER TABLE `clients` ADD COLUMN `requireProjectOnEntries` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `projects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `state` ENUM('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `ownerUserId` INTEGER NULL,
    `startsOn` DATE NULL,
    `endsOn` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `projects_uuid_key`(`uuid`),
    INDEX `projects_clientId_idx`(`clientId`),
    INDEX `projects_state_idx`(`state`),
    UNIQUE INDEX `projects_clientId_code_key`(`clientId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `projects` ADD CONSTRAINT `projects_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `time_entries` ADD COLUMN `projectId` INTEGER NULL;
CREATE INDEX `time_entries_projectId_idx` ON `time_entries`(`projectId`);
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
