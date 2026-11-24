-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `image` VARCHAR(2048) NULL,
    `session_version` INTEGER NOT NULL DEFAULT 0,
    `failed_login_count` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `is_platform_admin` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `type` ENUM('PASSWORD_RESET', 'EMAIL_VERIFICATION') NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_tokens_token_hash_key`(`token_hash`),
    INDEX `auth_tokens_user_id_type_idx`(`user_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspaces` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `type` ENUM('PERSONAL', 'TEAM', 'AGENCY') NOT NULL DEFAULT 'PERSONAL',
    `owner_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `workspaces_slug_key`(`slug`),
    INDEX `workspaces_owner_id_idx`(`owner_id`),
    INDEX `workspaces_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspace_members` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'EDITOR', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workspace_members_user_id_idx`(`user_id`),
    UNIQUE INDEX `workspace_members_workspace_id_user_id_key`(`workspace_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `businesses` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `industry` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `stage` ENUM('IDEA', 'STARTING', 'OPERATING', 'ESTABLISHED') NOT NULL DEFAULT 'IDEA',
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `businesses_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    INDEX `businesses_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_context_versions` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `data` JSON NOT NULL,
    `approved_sections` JSON NOT NULL,
    `change_note` VARCHAR(500) NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `approved_by_id` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `business_context_versions_business_id_status_idx`(`business_id`, `status`),
    UNIQUE INDEX `business_context_versions_business_id_version_key`(`business_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_generations` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NULL,
    `user_id` CHAR(36) NOT NULL,
    `context_version_id` CHAR(36) NULL,
    `module` VARCHAR(60) NOT NULL,
    `task` VARCHAR(80) NOT NULL,
    `kind` ENUM('TEXT', 'IMAGE') NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `model` VARCHAR(120) NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `input` JSON NOT NULL,
    `output` JSON NULL,
    `error_code` VARCHAR(80) NULL,
    `error_message` VARCHAR(1000) NULL,
    `latency_ms` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_generations_workspace_id_created_at_idx`(`workspace_id`, `created_at`),
    INDEX `ai_generations_business_id_module_idx`(`business_id`, `module`),
    INDEX `ai_generations_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage_records` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `generation_id` CHAR(36) NULL,
    `provider` VARCHAR(40) NOT NULL,
    `model` VARCHAR(120) NOT NULL,
    `kind` ENUM('TEXT', 'IMAGE') NOT NULL,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,
    `image_count` INTEGER NOT NULL DEFAULT 0,
    `cost_micro_usd` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_usage_records_workspace_id_created_at_idx`(`workspace_id`, `created_at`),
    INDEX `ai_usage_records_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usage_limits` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `metric` ENUM('AI_TEXT_REQUESTS', 'AI_IMAGE_REQUESTS', 'AI_COST_MICRO_USD', 'STORAGE_BYTES') NOT NULL,
    `period` ENUM('DAILY', 'MONTHLY') NOT NULL DEFAULT 'MONTHLY',
    `limit_value` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usage_limits_workspace_id_metric_period_key`(`workspace_id`, `metric`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stored_files` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NULL,
    `uploaded_by_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `bucket` VARCHAR(120) NOT NULL,
    `object_key` VARCHAR(512) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `checksum` CHAR(64) NOT NULL,
    `purpose` VARCHAR(60) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `stored_files_object_key_key`(`object_key`),
    INDEX `stored_files_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    INDEX `stored_files_business_id_idx`(`business_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NULL,
    `type` VARCHAR(60) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NULL,
    `link` VARCHAR(500) NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_at_idx`(`user_id`, `read_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NULL,
    `actor_id` CHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(60) NULL,
    `entity_id` VARCHAR(64) NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_workspace_id_created_at_idx`(`workspace_id`, `created_at`),
    INDEX `audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limit_buckets` (
    `key` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL,
    `reset_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `rate_limit_buckets_reset_at_idx`(`reset_at`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspace_members` ADD CONSTRAINT `workspace_members_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspace_members` ADD CONSTRAINT `workspace_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_context_versions` ADD CONSTRAINT `business_context_versions_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_context_versions` ADD CONSTRAINT `business_context_versions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_context_versions` ADD CONSTRAINT `business_context_versions_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generations` ADD CONSTRAINT `ai_generations_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generations` ADD CONSTRAINT `ai_generations_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generations` ADD CONSTRAINT `ai_generations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generations` ADD CONSTRAINT `ai_generations_context_version_id_fkey` FOREIGN KEY (`context_version_id`) REFERENCES `business_context_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_records` ADD CONSTRAINT `ai_usage_records_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_records` ADD CONSTRAINT `ai_usage_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_records` ADD CONSTRAINT `ai_usage_records_generation_id_fkey` FOREIGN KEY (`generation_id`) REFERENCES `ai_generations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_limits` ADD CONSTRAINT `usage_limits_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_files` ADD CONSTRAINT `stored_files_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_files` ADD CONSTRAINT `stored_files_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_files` ADD CONSTRAINT `stored_files_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
