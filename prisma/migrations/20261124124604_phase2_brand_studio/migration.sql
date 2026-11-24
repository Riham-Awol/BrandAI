-- AlterTable
ALTER TABLE `projects` MODIFY `type` ENUM('LAUNCH_STUDIO', 'BRAND_STUDIO') NOT NULL;

-- CreateTable
CREATE TABLE `brand_identities` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('APPROVED', 'SUPERSEDED') NOT NULL DEFAULT 'APPROVED',
    `data` JSON NOT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `approved_by_id` CHAR(36) NOT NULL,
    `approved_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `brand_identities_business_id_status_idx`(`business_id`, `status`),
    UNIQUE INDEX `brand_identities_business_id_version_key`(`business_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brand_assets` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `stored_file_id` CHAR(36) NOT NULL,
    `kind` ENUM('LOGO', 'ICON', 'IMAGE', 'DOCUMENT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `name` VARCHAR(160) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `brand_assets_business_id_deleted_at_idx`(`business_id`, `deleted_at`),
    INDEX `brand_assets_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storage_objects` (
    `object_key` VARCHAR(512) NOT NULL,
    `content_type` VARCHAR(120) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `data` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`object_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `brand_identities` ADD CONSTRAINT `brand_identities_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_identities` ADD CONSTRAINT `brand_identities_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_identities` ADD CONSTRAINT `brand_identities_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_identities` ADD CONSTRAINT `brand_identities_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_identities` ADD CONSTRAINT `brand_identities_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_assets` ADD CONSTRAINT `brand_assets_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_assets` ADD CONSTRAINT `brand_assets_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_assets` ADD CONSTRAINT `brand_assets_stored_file_id_fkey` FOREIGN KEY (`stored_file_id`) REFERENCES `stored_files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_assets` ADD CONSTRAINT `brand_assets_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
