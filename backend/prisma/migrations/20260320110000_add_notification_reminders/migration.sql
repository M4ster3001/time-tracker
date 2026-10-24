CREATE TABLE `user_notification_preferences` (
  `userId` INTEGER NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `timesJson` TEXT NOT NULL,
  `snoozeMinutes` INTEGER NOT NULL DEFAULT 30,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`),
  CONSTRAINT `user_notification_preferences_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notification_reminders` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `clientId` INTEGER NOT NULL,
  `reminderDate` DATE NOT NULL,
  `scheduledTime` VARCHAR(5) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `snoozedUntil` DATETIME(3) NULL,
  `triggeredAt` DATETIME(3) NULL,
  `dismissedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `notif_rem_u_c_d_t_key` (`userId`, `clientId`, `reminderDate`, `scheduledTime`),
  INDEX `notif_rem_u_d_s_idx` (`userId`, `reminderDate`, `status`),
  INDEX `notif_rem_u_snz_idx` (`userId`, `snoozedUntil`),
  INDEX `notif_rem_c_d_idx` (`clientId`, `reminderDate`),
  PRIMARY KEY (`id`),
  CONSTRAINT `notification_reminders_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `notification_reminders_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
