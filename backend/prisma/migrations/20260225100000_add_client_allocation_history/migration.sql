CREATE TABLE IF NOT EXISTS `client_allocation_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `clientId` INT NOT NULL,
  `allocationType` ENUM('DAILY', 'MONTHLY') NOT NULL,
  `hoursPerDay` DOUBLE NULL,
  `hoursPerMonth` DOUBLE NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `createdBy` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `client_allocation_history_userId_clientId_effectiveFrom_idx` (`userId`, `clientId`, `effectiveFrom`),
  INDEX `client_allocation_history_userId_clientId_effectiveTo_idx` (`userId`, `clientId`, `effectiveTo`),
  INDEX `client_allocation_history_effectiveFrom_effectiveTo_idx` (`effectiveFrom`, `effectiveTo`),
  CONSTRAINT `client_allocation_history_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `client_allocation_history_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `client_allocation_history` (
  `userId`,
  `clientId`,
  `allocationType`,
  `hoursPerDay`,
  `hoursPerMonth`,
  `effectiveFrom`,
  `effectiveTo`,
  `createdBy`,
  `createdAt`,
  `updatedAt`
)
SELECT
  ca.`userId`,
  ca.`clientId`,
  ca.`allocationType`,
  ca.`hoursPerDay`,
  ca.`hoursPerMonth`,
  DATE_FORMAT(UTC_DATE(), '%Y-%m-01'),
  NULL,
  NULL,
  ca.`createdAt`,
  ca.`updatedAt`
FROM `client_allocations` ca
LEFT JOIN `client_allocation_history` cah
  ON cah.`userId` = ca.`userId`
 AND cah.`clientId` = ca.`clientId`
 AND cah.`effectiveTo` IS NULL
WHERE cah.`id` IS NULL;
