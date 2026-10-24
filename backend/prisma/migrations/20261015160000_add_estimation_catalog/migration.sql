-- EST-01: tipos de tarefa e parametros versionados de estimativa.
CREATE TABLE `task_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `namePt` VARCHAR(120) NOT NULL,
    `nameEn` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `task_types_uuid_key`(`uuid`),
    UNIQUE INDEX `task_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `estimation_parameter_sets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `taskTypeId` INTEGER NOT NULL,
    `scope` ENUM('GLOBAL', 'CLIENT', 'PROJECT') NOT NULL DEFAULT 'GLOBAL',
    `clientId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `estimation_parameter_sets_uuid_key`(`uuid`),
    INDEX `estimation_parameter_sets_taskTypeId_scope_idx`(`taskTypeId`, `scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `estimation_parameter_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `parameterSetId` INTEGER NOT NULL,
    `baseMinutes` INTEGER NOT NULL,
    `factor` DECIMAL(8, 4) NOT NULL,
    `roundingMode` VARCHAR(32) NOT NULL DEFAULT 'NEAREST_MINUTE',
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `authorUserId` INTEGER NULL,
    `reason` TEXT NULL,
    `previousRevisionId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `estimation_parameter_revisions_uuid_key`(`uuid`),
    INDEX `estimation_parameter_revisions_parameterSetId_effectiveFrom_idx`(`parameterSetId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `estimation_parameter_sets` ADD CONSTRAINT `estimation_parameter_sets_taskTypeId_fkey` FOREIGN KEY (`taskTypeId`) REFERENCES `task_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `estimation_parameter_revisions` ADD CONSTRAINT `estimation_parameter_revisions_parameterSetId_fkey` FOREIGN KEY (`parameterSetId`) REFERENCES `estimation_parameter_sets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
