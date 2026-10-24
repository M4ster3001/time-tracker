-- EST-02: confirmacoes versionadas; TRK-01 sessoes; SRC-01 referencias; CAL-01 propostas.

CREATE TABLE `duration_confirmations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `timeEntryId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `confirmedMinutes` INTEGER NOT NULL,
    `estimatedMinutesSnapshot` INTEGER NULL,
    `justification` TEXT NULL,
    `confirmedByUserId` INTEGER NOT NULL,
    `confirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `previousConfirmationId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `duration_confirmations_uuid_key`(`uuid`),
    UNIQUE INDEX `duration_confirmations_timeEntryId_version_key`(`timeEntryId`, `version`),
    INDEX `duration_confirmations_timeEntryId_confirmedAt_idx`(`timeEntryId`, `confirmedAt`),
    INDEX `duration_confirmations_confirmedByUserId_idx`(`confirmedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `estimation_references` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `provider` VARCHAR(64) NOT NULL,
    `kind` ENUM('COMMIT', 'PULL_REQUEST', 'ISSUE', 'DOCUMENT', 'MANUAL') NOT NULL,
    `externalId` VARCHAR(255) NOT NULL,
    `repository` VARCHAR(255) NULL,
    `dedupeKey` VARCHAR(512) NOT NULL,
    `title` VARCHAR(500) NULL,
    `uri` VARCHAR(1000) NULL,
    `timeEntryId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `authorUserId` INTEGER NULL,
    `collectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `estimation_references_uuid_key`(`uuid`),
    UNIQUE INDEX `estimation_references_dedupeKey_key`(`dedupeKey`),
    INDEX `estimation_references_timeEntryId_idx`(`timeEntryId`),
    INDEX `estimation_references_projectId_idx`(`projectId`),
    INDEX `estimation_references_kind_provider_idx`(`kind`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tracking_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `userId` INTEGER NOT NULL,
    `timeEntryId` INTEGER NULL,
    `state` ENUM('RUNNING', 'PAUSED', 'STOPPED') NOT NULL DEFAULT 'RUNNING',
    `source` ENUM('TIMER', 'IMPORT') NOT NULL DEFAULT 'TIMER',
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `pausedAt` DATETIME(3) NULL,
    `accumulatedPausedMs` INTEGER NOT NULL DEFAULT 0,
    `externalId` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `tracking_sessions_uuid_key`(`uuid`),
    INDEX `tracking_sessions_userId_state_idx`(`userId`, `state`),
    INDEX `tracking_sessions_timeEntryId_idx`(`timeEntryId`),
    UNIQUE INDEX `tracking_sessions_source_externalId_key`(`source`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `calibration_proposals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `taskTypeCode` VARCHAR(64) NULL,
    `sampleSize` INTEGER NOT NULL,
    `medianAbsErrorMinutes` DOUBLE NULL,
    `biasMinutes` DOUBLE NULL,
    `measuredSampleSize` INTEGER NOT NULL DEFAULT 0,
    `proposedBaseMinutes` INTEGER NULL,
    `proposedFactor` DECIMAL(8, 4) NULL,
    `justification` TEXT NULL,
    `state` ENUM('DRAFT', 'PROPOSED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `authorUserId` INTEGER NOT NULL,
    `decidedByUserId` INTEGER NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `calibration_proposals_uuid_key`(`uuid`),
    INDEX `calibration_proposals_state_createdAt_idx`(`state`, `createdAt`),
    INDEX `calibration_proposals_authorUserId_idx`(`authorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `duration_confirmations` ADD CONSTRAINT `duration_confirmations_timeEntryId_fkey` FOREIGN KEY (`timeEntryId`) REFERENCES `time_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `duration_confirmations` ADD CONSTRAINT `duration_confirmations_confirmedByUserId_fkey` FOREIGN KEY (`confirmedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `duration_confirmations` ADD CONSTRAINT `duration_confirmations_previousConfirmationId_fkey` FOREIGN KEY (`previousConfirmationId`) REFERENCES `duration_confirmations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `estimation_references` ADD CONSTRAINT `estimation_references_timeEntryId_fkey` FOREIGN KEY (`timeEntryId`) REFERENCES `time_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `estimation_references` ADD CONSTRAINT `estimation_references_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `estimation_references` ADD CONSTRAINT `estimation_references_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `tracking_sessions` ADD CONSTRAINT `tracking_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tracking_sessions` ADD CONSTRAINT `tracking_sessions_timeEntryId_fkey` FOREIGN KEY (`timeEntryId`) REFERENCES `time_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `calibration_proposals` ADD CONSTRAINT `calibration_proposals_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
