-- PRJ-01: project memberships
CREATE TABLE `project_memberships` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `role` VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `project_memberships_projectId_userId_key`(`projectId`, `userId`),
    INDEX `project_memberships_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `project_memberships`
  ADD CONSTRAINT `project_memberships_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `project_memberships`
  ADD CONSTRAINT `project_memberships_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- SRC-01: evidence versioning (dedupeKey + evidenceVersion)
ALTER TABLE `estimation_references`
  ADD COLUMN `evidenceVersion` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `contentFingerprint` VARCHAR(64) NULL,
  ADD COLUMN `previousReferenceId` INTEGER NULL;

-- Drop unique on dedupeKey alone if present; unique becomes (dedupeKey, evidenceVersion)
ALTER TABLE `estimation_references` DROP INDEX `estimation_references_dedupeKey_key`;

CREATE UNIQUE INDEX `estimation_references_dedupeKey_evidenceVersion_key`
  ON `estimation_references`(`dedupeKey`, `evidenceVersion`);

CREATE INDEX `estimation_references_dedupeKey_idx` ON `estimation_references`(`dedupeKey`);

ALTER TABLE `estimation_references`
  ADD CONSTRAINT `estimation_references_previousReferenceId_fkey`
  FOREIGN KEY (`previousReferenceId`) REFERENCES `estimation_references`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
