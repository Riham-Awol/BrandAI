-- AlterTable
ALTER TABLE `projects` MODIFY `type` ENUM('LAUNCH_STUDIO', 'BRAND_STUDIO', 'STRATEGY_STUDIO') NOT NULL;

-- CreateTable
CREATE TABLE `marketing_plans` (
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

    INDEX `marketing_plans_business_id_status_idx`(`business_id`, `status`),
    UNIQUE INDEX `marketing_plans_business_id_version_key`(`business_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `marketing_plans` ADD CONSTRAINT `marketing_plans_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_plans` ADD CONSTRAINT `marketing_plans_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_plans` ADD CONSTRAINT `marketing_plans_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_plans` ADD CONSTRAINT `marketing_plans_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_plans` ADD CONSTRAINT `marketing_plans_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
