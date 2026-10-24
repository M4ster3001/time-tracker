-- DropForeignKey
ALTER TABLE `email_dispatch_logs` DROP FOREIGN KEY `email_dispatch_logs_dispatchId_fkey`;

-- DropForeignKey
ALTER TABLE `email_dispatches` DROP FOREIGN KEY `email_dispatches_smtpConfigId_fkey`;

-- DropTable
DROP TABLE `email_dispatch_logs`;

-- DropTable
DROP TABLE `email_dispatches`;

-- DropTable
DROP TABLE `smtp_configs`;
