-- AlterTable
ALTER TABLE `workspaces` ADD COLUMN `ai_learning_enabled` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `ai_examples` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `module` VARCHAR(40) NOT NULL,
    `task` VARCHAR(60) NOT NULL,
    `source` VARCHAR(10) NOT NULL,
    `content` JSON NOT NULL,
    `source_ref` VARCHAR(80) NOT NULL,
    `created_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_examples_source_ref_key`(`source_ref`),
    INDEX `ai_examples_business_id_module_task_updated_at_idx`(`business_id`, `module`, `task`, `updated_at`),
    INDEX `ai_examples_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_examples` ADD CONSTRAINT `ai_examples_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_examples` ADD CONSTRAINT `ai_examples_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
