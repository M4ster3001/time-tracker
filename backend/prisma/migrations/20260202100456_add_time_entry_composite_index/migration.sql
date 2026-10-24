-- CreateIndex
CREATE INDEX `time_entries_userId_clientId_date_idx` ON `time_entries`(`userId`, `clientId`, `date`);
