-- CreateTable
CREATE TABLE `site_views` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `website_id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `day` DATE NOT NULL,
    `path` VARCHAR(64) NOT NULL,
    `referrer_host` VARCHAR(253) NULL,
    `visitor_hash` CHAR(64) NOT NULL,
    `device` VARCHAR(10) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `site_views_website_id_day_idx`(`website_id`, `day`),
    INDEX `site_views_workspace_id_day_idx`(`workspace_id`, `day`),
    INDEX `site_views_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `delivery_id` CHAR(36) NOT NULL,
    `campaign_id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_events_workspace_id_created_at_idx`(`workspace_id`, `created_at`),
    INDEX `email_events_campaign_id_type_idx`(`campaign_id`, `type`),
    UNIQUE INDEX `email_events_delivery_id_type_key`(`delivery_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_metrics` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `scheduled_item_id` CHAR(36) NOT NULL,
    `reach` INTEGER NULL,
    `impressions` INTEGER NULL,
    `likes` INTEGER NULL,
    `comments` INTEGER NULL,
    `shares` INTEGER NULL,
    `saves` INTEGER NULL,
    `clicks` INTEGER NULL,
    `recorded_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `post_metrics_scheduled_item_id_key`(`scheduled_item_id`),
    INDEX `post_metrics_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analytics_reports` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NULL,
    `period_days` INTEGER NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `metrics` JSON NOT NULL,
    `insights` JSON NOT NULL,
    `is_mock` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `analytics_reports_workspace_id_created_at_idx`(`workspace_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analytics_settings` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `track_site_visits` BOOLEAN NOT NULL DEFAULT true,
    `track_email_engagement` BOOLEAN NOT NULL DEFAULT true,
    `retention_days` INTEGER NOT NULL DEFAULT 395,
    `updated_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `analytics_settings_workspace_id_key`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `site_views` ADD CONSTRAINT `site_views_website_id_fkey` FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_views` ADD CONSTRAINT `site_views_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_events` ADD CONSTRAINT `email_events_delivery_id_fkey` FOREIGN KEY (`delivery_id`) REFERENCES `email_deliveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_events` ADD CONSTRAINT `email_events_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_metrics` ADD CONSTRAINT `post_metrics_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_metrics` ADD CONSTRAINT `post_metrics_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_metrics` ADD CONSTRAINT `post_metrics_scheduled_item_id_fkey` FOREIGN KEY (`scheduled_item_id`) REFERENCES `scheduled_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analytics_reports` ADD CONSTRAINT `analytics_reports_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analytics_reports` ADD CONSTRAINT `analytics_reports_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analytics_settings` ADD CONSTRAINT `analytics_settings_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
