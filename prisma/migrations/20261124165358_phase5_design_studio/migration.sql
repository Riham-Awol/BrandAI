-- CreateTable
CREATE TABLE `designs` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `kind` ENUM('POSTER', 'FLYER', 'AD', 'BANNER', 'PRODUCT', 'EVENT', 'SOCIAL') NOT NULL,
    `format` VARCHAR(40) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `brief` JSON NOT NULL,
    `spec` JSON NOT NULL,
    `image_file_id` CHAR(36) NULL,
    `source_post_id` CHAR(36) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `is_mock` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `designs_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    INDEX `designs_business_id_kind_idx`(`business_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `design_revisions` (
    `id` CHAR(36) NOT NULL,
    `design_id` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `format` VARCHAR(40) NOT NULL,
    `spec` JSON NOT NULL,
    `image_file_id` CHAR(36) NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `design_revisions_design_id_version_key`(`design_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `designs` ADD CONSTRAINT `designs_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designs` ADD CONSTRAINT `designs_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `design_revisions` ADD CONSTRAINT `design_revisions_design_id_fkey` FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
