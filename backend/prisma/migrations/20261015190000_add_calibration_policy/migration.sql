-- CAL-01: limiares configuraveis (null = sem gate; produto define numeros antes do piloto).
CREATE TABLE `calibration_policies` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `minSampleSize` INTEGER NULL,
    `minMeasuredSampleSize` INTEGER NULL,
    `maxMedianAbsoluteErrorMinutes` DOUBLE NULL,
    `maxAbsoluteBiasMinutes` DOUBLE NULL,
    `updatedByUserId` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `calibration_policies` (`id`, `minSampleSize`, `minMeasuredSampleSize`, `maxMedianAbsoluteErrorMinutes`, `maxAbsoluteBiasMinutes`, `updatedByUserId`, `updatedAt`, `createdAt`)
VALUES (1, NULL, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
