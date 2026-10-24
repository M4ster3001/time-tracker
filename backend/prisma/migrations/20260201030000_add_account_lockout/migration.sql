-- SEC-03: Add account lockout fields to users table
ALTER TABLE `users` ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `lockedUntil` DATETIME(3) NULL;
ALTER TABLE `users` ADD COLUMN `lastFailedLoginAt` DATETIME(3) NULL;

-- Add index for efficient lockout queries
CREATE INDEX `users_email_lockedUntil_idx` ON `users`(`email`, `lockedUntil`);
