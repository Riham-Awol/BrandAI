-- AlterTable
ALTER TABLE `workspaces` ADD COLUMN `agency_workspace_id` CHAR(36) NULL,
    ADD COLUMN `suspended_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `plan` ENUM('FREE', 'PRO', 'AGENCY') NOT NULL DEFAULT 'FREE',
    `status` ENUM('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE') NOT NULL DEFAULT 'ACTIVE',
    `source` VARCHAR(10) NOT NULL DEFAULT 'STRIPE',
    `stripe_customer_id` VARCHAR(255) NULL,
    `stripe_subscription_id` VARCHAR(255) NULL,
    `stripe_price_id` VARCHAR(255) NULL,
    `current_period_end` DATETIME(3) NULL,
    `cancel_at_period_end` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscriptions_workspace_id_key`(`workspace_id`),
    UNIQUE INDEX `subscriptions_stripe_customer_id_key`(`stripe_customer_id`),
    UNIQUE INDEX `subscriptions_stripe_subscription_id_key`(`stripe_subscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_credit_entries` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `amount` INTEGER NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `reference` VARCHAR(255) NULL,
    `note` VARCHAR(300) NULL,
    `created_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_credit_entries_workspace_id_created_at_idx`(`workspace_id`, `created_at`),
    UNIQUE INDEX `ai_credit_entries_kind_reference_key`(`kind`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_events` (
    `id` VARCHAR(255) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agency_clients` (
    `id` CHAR(36) NOT NULL,
    `agency_workspace_id` CHAR(36) NOT NULL,
    `client_workspace_id` CHAR(36) NOT NULL,
    `contact_name` VARCHAR(120) NULL,
    `contact_email` VARCHAR(320) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `agency_clients_client_workspace_id_key`(`client_workspace_id`),
    INDEX `agency_clients_agency_workspace_id_status_idx`(`agency_workspace_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_settings` (
    `key` VARCHAR(60) NOT NULL,
    `value` JSON NOT NULL,
    `updated_by_id` CHAR(36) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `workspaces_agency_workspace_id_idx` ON `workspaces`(`agency_workspace_id`);

-- AddForeignKey
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_agency_workspace_id_fkey` FOREIGN KEY (`agency_workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_credit_entries` ADD CONSTRAINT `ai_credit_entries_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agency_clients` ADD CONSTRAINT `agency_clients_agency_workspace_id_fkey` FOREIGN KEY (`agency_workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agency_clients` ADD CONSTRAINT `agency_clients_client_workspace_id_fkey` FOREIGN KEY (`client_workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
