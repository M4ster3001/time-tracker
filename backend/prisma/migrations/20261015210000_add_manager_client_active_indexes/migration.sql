-- Manager dashboards / team lists filter users by managerId + isActive together.
CREATE INDEX `users_managerId_isActive_idx` ON `users`(`managerId`, `isActive`);

-- Client listings and allocation joins commonly filter on isActive.
CREATE INDEX `clients_isActive_idx` ON `clients`(`isActive`);
