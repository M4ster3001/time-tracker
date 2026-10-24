-- WorkActivity + EstimateRevision; links em confirmacoes/apontamentos; CAL approval fields.

CREATE TABLE `work_activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `projectId` INTEGER NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `taskTypeId` INTEGER NULL,
    `ownerUserId` INTEGER NULL,
    `state` ENUM('OPEN', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `work_activities_uuid_key`(`uuid`),
    INDEX `work_activities_clientId_state_idx`(`clientId`, `state`),
    INDEX `work_activities_projectId_idx`(`projectId`),
    INDEX `work_activities_ownerUserId_idx`(`ownerUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `estimate_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `workActivityId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `baseMinutes` INTEGER NOT NULL,
    `factor` DECIMAL(8, 4) NOT NULL,
    `rawMinutes` DECIMAL(12, 4) NOT NULL,
    `suggestedMinutes` INTEGER NOT NULL,
    `roundingMode` VARCHAR(32) NOT NULL DEFAULT 'NEAREST_MINUTE',
    `parameterRevisionUuid` VARCHAR(36) NULL,
    `origin` ENUM('CATALOG', 'ONE_OFF', 'MCP', 'AI') NOT NULL DEFAULT 'CATALOG',
    `algorithmVersion` VARCHAR(32) NOT NULL DEFAULT 'EST-01',
    `authorUserId` INTEGER NULL,
    `reason` TEXT NULL,
    `previousRevisionId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `estimate_revisions_uuid_key`(`uuid`),
    UNIQUE INDEX `estimate_revisions_workActivityId_version_key`(`workActivityId`, `version`),
    INDEX `estimate_revisions_workActivityId_createdAt_idx`(`workActivityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `time_entries` ADD COLUMN `workActivityId` INTEGER NULL;
CREATE INDEX `time_entries_workActivityId_idx` ON `time_entries`(`workActivityId`);

ALTER TABLE `duration_confirmations` ADD COLUMN `workActivityId` INTEGER NULL;
ALTER TABLE `duration_confirmations` ADD COLUMN `estimateRevisionId` INTEGER NULL;
CREATE INDEX `duration_confirmations_workActivityId_idx` ON `duration_confirmations`(`workActivityId`);
CREATE INDEX `duration_confirmations_estimateRevisionId_idx` ON `duration_confirmations`(`estimateRevisionId`);

ALTER TABLE `calibration_proposals` ADD COLUMN `parameterSetId` INTEGER NULL;
ALTER TABLE `calibration_proposals` ADD COLUMN `resultingRevisionId` INTEGER NULL;
CREATE INDEX `calibration_proposals_parameterSetId_idx` ON `calibration_proposals`(`parameterSetId`);

ALTER TABLE `work_activities` ADD CONSTRAINT `work_activities_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `work_activities` ADD CONSTRAINT `work_activities_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `work_activities` ADD CONSTRAINT `work_activities_taskTypeId_fkey` FOREIGN KEY (`taskTypeId`) REFERENCES `task_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `work_activities` ADD CONSTRAINT `work_activities_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `estimate_revisions` ADD CONSTRAINT `estimate_revisions_workActivityId_fkey` FOREIGN KEY (`workActivityId`) REFERENCES `work_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `estimate_revisions` ADD CONSTRAINT `estimate_revisions_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `estimate_revisions` ADD CONSTRAINT `estimate_revisions_previousRevisionId_fkey` FOREIGN KEY (`previousRevisionId`) REFERENCES `estimate_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_workActivityId_fkey` FOREIGN KEY (`workActivityId`) REFERENCES `work_activities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `duration_confirmations` ADD CONSTRAINT `duration_confirmations_workActivityId_fkey` FOREIGN KEY (`workActivityId`) REFERENCES `work_activities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `duration_confirmations` ADD CONSTRAINT `duration_confirmations_estimateRevisionId_fkey` FOREIGN KEY (`estimateRevisionId`) REFERENCES `estimate_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `calibration_proposals` ADD CONSTRAINT `calibration_proposals_parameterSetId_fkey` FOREIGN KEY (`parameterSetId`) REFERENCES `estimation_parameter_sets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
