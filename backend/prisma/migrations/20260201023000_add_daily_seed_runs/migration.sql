CREATE TABLE `seed_runs` (
  `key` VARCHAR(191) NOT NULL,
  `lastRunDate` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
