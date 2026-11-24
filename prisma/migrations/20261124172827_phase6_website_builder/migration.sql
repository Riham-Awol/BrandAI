-- CreateTable
CREATE TABLE `websites` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `type` ENUM('BUSINESS', 'LANDING', 'PORTFOLIO', 'STORE') NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(63) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'UNPUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `config` JSON NOT NULL,
    `draft_revision` INTEGER NOT NULL DEFAULT 1,
    `published_version` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `custom_domain` VARCHAR(253) NULL,
    `domain_status` ENUM('PENDING', 'VERIFIED', 'FAILED') NULL,
    `domain_token` CHAR(32) NULL,
    `domain_checked_at` DATETIME(3) NULL,
    `is_mock` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `websites_slug_key`(`slug`),
    UNIQUE INDEX `websites_custom_domain_key`(`custom_domain`),
    INDEX `websites_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    INDEX `websites_business_id_idx`(`business_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_versions` (
    `id` CHAR(36) NOT NULL,
    `website_id` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `config` JSON NOT NULL,
    `brand` JSON NOT NULL,
    `published_by_id` CHAR(36) NOT NULL,
    `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `website_versions_website_id_version_key`(`website_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_submissions` (
    `id` CHAR(36) NOT NULL,
    `website_id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `message` TEXT NOT NULL,
    `item` VARCHAR(200) NULL,
    `page_path` VARCHAR(200) NOT NULL,
    `ip_hash` CHAR(64) NOT NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `website_submissions_website_id_created_at_idx`(`website_id`, `created_at`),
    INDEX `website_submissions_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `websites` ADD CONSTRAINT `websites_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `websites` ADD CONSTRAINT `websites_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_versions` ADD CONSTRAINT `website_versions_website_id_fkey` FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_submissions` ADD CONSTRAINT `website_submissions_website_id_fkey` FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_submissions` ADD CONSTRAINT `website_submissions_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
