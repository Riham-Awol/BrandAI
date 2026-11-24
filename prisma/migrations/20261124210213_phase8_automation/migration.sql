-- CreateTable
CREATE TABLE `automation_settings` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `mode` ENUM('DRAFT_ONLY', 'APPROVAL_REQUIRED', 'AUTOMATED') NOT NULL DEFAULT 'DRAFT_ONLY',
    `daily_publish_limit` INTEGER NOT NULL DEFAULT 10,
    `daily_email_limit` INTEGER NOT NULL DEFAULT 200,
    `require_separate_approver` BOOLEAN NOT NULL DEFAULT false,
    `timezone` VARCHAR(60) NOT NULL DEFAULT 'Europe/London',
    `updated_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `automation_settings_workspace_id_key`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integrations` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `type` ENUM('WEBHOOK', 'TELEGRAM', 'FACEBOOK_PAGE') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `config` JSON NOT NULL,
    `secret_encrypted` TEXT NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED', 'ERROR') NOT NULL DEFAULT 'ACTIVE',
    `last_used_at` DATETIME(3) NULL,
    `last_error` VARCHAR(500) NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `integrations_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_items` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `source_type` ENUM('SOCIAL_POST', 'EMAIL_CAMPAIGN', 'CUSTOM') NOT NULL,
    `source_id` CHAR(36) NULL,
    `integration_id` CHAR(36) NULL,
    `content` JSON NOT NULL,
    `scheduled_at` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHING', 'PUBLISHED', 'MANUAL_DUE', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `requested_by_id` CHAR(36) NOT NULL,
    `approved_by_id` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `decision_note` VARCHAR(500) NULL,
    `published_at` DATETIME(3) NULL,
    `external_url` VARCHAR(500) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_error` VARCHAR(500) NULL,
    `locked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `scheduled_items_status_scheduled_at_idx`(`status`, `scheduled_at`),
    INDEX `scheduled_items_workspace_id_scheduled_at_idx`(`workspace_id`, `scheduled_at`),
    INDEX `scheduled_items_source_type_source_id_idx`(`source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_contacts` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `name` VARCHAR(120) NULL,
    `consent_source` VARCHAR(200) NOT NULL,
    `consent_at` DATETIME(3) NOT NULL,
    `unsubscribed_at` DATETIME(3) NULL,
    `unsubscribe_token` CHAR(43) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_contacts_unsubscribe_token_key`(`unsubscribe_token`),
    INDEX `email_contacts_workspace_id_idx`(`workspace_id`),
    UNIQUE INDEX `email_contacts_business_id_email_key`(`business_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_campaigns` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `preheader` VARCHAR(200) NOT NULL DEFAULT '',
    `content` JSON NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `sent_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `sent_at` DATETIME(3) NULL,
    `is_mock` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `email_campaigns_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_deliveries` (
    `id` CHAR(36) NOT NULL,
    `campaign_id` CHAR(36) NOT NULL,
    `contact_id` CHAR(36) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `error` VARCHAR(300) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_deliveries_created_at_idx`(`created_at`),
    UNIQUE INDEX `email_deliveries_campaign_id_contact_id_key`(`campaign_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminders` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `note` VARCHAR(1000) NULL,
    `link` VARCHAR(300) NULL,
    `due_at` DATETIME(3) NOT NULL,
    `fired_at` DATETIME(3) NULL,
    `done_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reminders_fired_at_due_at_idx`(`fired_at`, `due_at`),
    INDEX `reminders_workspace_id_user_id_idx`(`workspace_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_rules` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `template` VARCHAR(60) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `params` JSON NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `last_run_at` DATETIME(3) NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `automation_rules_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_runs` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `outcome` VARCHAR(20) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `rule_id` CHAR(36) NULL,
    `item_id` CHAR(36) NULL,
    `actor_id` CHAR(36) NULL,
    `details` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `automation_runs_workspace_id_created_at_idx`(`workspace_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `automation_settings` ADD CONSTRAINT `automation_settings_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integrations` ADD CONSTRAINT `integrations_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_items` ADD CONSTRAINT `scheduled_items_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_items` ADD CONSTRAINT `scheduled_items_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_items` ADD CONSTRAINT `scheduled_items_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_contacts` ADD CONSTRAINT `email_contacts_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_contacts` ADD CONSTRAINT `email_contacts_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_campaigns` ADD CONSTRAINT `email_campaigns_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_campaigns` ADD CONSTRAINT `email_campaigns_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_deliveries` ADD CONSTRAINT `email_deliveries_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `email_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_deliveries` ADD CONSTRAINT `email_deliveries_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `email_contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `automation_rules` ADD CONSTRAINT `automation_rules_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `automation_runs` ADD CONSTRAINT `automation_runs_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
