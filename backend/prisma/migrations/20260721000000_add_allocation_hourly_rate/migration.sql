-- AlterTable
ALTER TABLE `client_allocations` ADD COLUMN `hourlyRate` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `client_allocation_history` ADD COLUMN `hourlyRate` DECIMAL(10, 2) NULL;
