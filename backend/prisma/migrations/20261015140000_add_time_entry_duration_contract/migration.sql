-- DAT-01: campos aditivos para tres duracoes. Sem backfill de confirmacao/medicao.
ALTER TABLE `time_entries`
  ADD COLUMN `estimatedDurationMinutes` INTEGER NULL,
  ADD COLUMN `confirmedDurationMinutes` INTEGER NULL,
  ADD COLUMN `actualTrackedDurationMinutes` INTEGER NULL,
  ADD COLUMN `confirmedAt` DATETIME(3) NULL,
  ADD COLUMN `confirmedByUserId` INTEGER NULL;
