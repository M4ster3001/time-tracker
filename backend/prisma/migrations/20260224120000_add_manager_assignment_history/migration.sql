CREATE TABLE IF NOT EXISTS `manager_assignment_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `managerId` INT NOT NULL,
  `consultantId` INT NOT NULL,
  `startDate` DATE NOT NULL,
  `endDate` DATE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `manager_assignment_history_consultantId_startDate_endDate_idx` (`consultantId`, `startDate`, `endDate`),
  INDEX `manager_assignment_history_managerId_startDate_endDate_idx` (`managerId`, `startDate`, `endDate`),
  CONSTRAINT `manager_assignment_history_managerId_fkey`
    FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `manager_assignment_history_consultantId_fkey`
    FOREIGN KEY (`consultantId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `manager_assignment_history` (`managerId`, `consultantId`, `startDate`, `endDate`, `createdAt`)
SELECT u.`managerId`, u.`id`, DATE(u.`createdAt`), NULL, NOW(3)
FROM `users` u
LEFT JOIN `manager_assignment_history` mah
  ON mah.`consultantId` = u.`id` AND mah.`endDate` IS NULL
WHERE u.`roleId` = 3
  AND u.`managerId` IS NOT NULL
  AND mah.`id` IS NULL;
