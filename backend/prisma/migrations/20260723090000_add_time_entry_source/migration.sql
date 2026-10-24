-- AlterTable
ALTER TABLE `time_entries` ADD COLUMN `source` ENUM('PORTAL', 'API') NOT NULL DEFAULT 'PORTAL';
