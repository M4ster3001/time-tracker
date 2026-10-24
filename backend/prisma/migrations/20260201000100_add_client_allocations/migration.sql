-- CreateTable
CREATE TABLE `client_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `clientId` INTEGER NOT NULL,
    `allocationType` ENUM('DAILY', 'MONTHLY') NOT NULL,
    `hoursPerDay` DOUBLE NULL,
    `hoursPerMonth` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_allocations_userId_clientId_key`(`userId`, `clientId`),
    INDEX `client_allocations_userId_idx`(`userId`),
    INDEX `client_allocations_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `client_allocations` ADD CONSTRAINT `client_allocations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_allocations` ADD CONSTRAINT `client_allocations_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
