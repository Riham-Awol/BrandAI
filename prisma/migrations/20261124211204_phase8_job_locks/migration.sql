-- CreateTable
CREATE TABLE `job_locks` (
    `name` VARCHAR(80) NOT NULL,
    `owner` CHAR(36) NOT NULL,
    `locked_until` DATETIME(3) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
