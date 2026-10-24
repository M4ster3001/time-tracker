-- CAL-01: contexto de precedência para alvo do set (sem fallback GLOBAL cego).
ALTER TABLE `calibration_proposals` ADD COLUMN `targetClientId` INTEGER NULL;
ALTER TABLE `calibration_proposals` ADD COLUMN `targetProjectId` INTEGER NULL;
