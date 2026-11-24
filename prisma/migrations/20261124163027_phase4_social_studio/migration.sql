-- AlterTable
ALTER TABLE `projects` MODIFY `type` ENUM('LAUNCH_STUDIO', 'BRAND_STUDIO', 'STRATEGY_STUDIO', 'SOCIAL_STUDIO') NOT NULL;

-- CreateTable
CREATE TABLE `social_posts` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `calendar_output_id` CHAR(36) NULL,
    `scheduled_date` DATE NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN') NOT NULL,
    `format` ENUM('POST', 'CAROUSEL', 'STORY', 'SHORT_VIDEO') NOT NULL,
    `pillar` VARCHAR(120) NULL,
    `title` VARCHAR(200) NOT NULL,
    `objective` VARCHAR(500) NULL,
    `is_promotion` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('IDEA', 'DRAFT', 'READY') NOT NULL DEFAULT 'IDEA',
    `content` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `is_mock` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `social_posts_project_id_scheduled_date_idx`(`project_id`, `scheduled_date`),
    INDEX `social_posts_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    INDEX `social_posts_business_id_idx`(`business_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_post_revisions` (
    `id` CHAR(36) NOT NULL,
    `post_id` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `source` ENUM('AI', 'EDIT') NOT NULL,
    `content` JSON NOT NULL,
    `feedback` VARCHAR(1000) NULL,
    `generation_id` CHAR(36) NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `social_post_revisions_post_id_version_key`(`post_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_post_revisions` ADD CONSTRAINT `social_post_revisions_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
