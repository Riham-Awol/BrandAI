-- AlterTable
ALTER TABLE `users` ADD COLUMN `mfa_enabled_at` DATETIME(3) NULL,
    ADD COLUMN `mfa_last_step` INTEGER NULL,
    ADD COLUMN `mfa_recovery_codes` JSON NULL,
    ADD COLUMN `mfa_secret` VARCHAR(255) NULL,
    ADD COLUMN `suspended_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `workspace_invitations` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'EDITOR', 'VIEWER') NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `invited_by_id` CHAR(36) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `workspace_invitations_token_hash_key`(`token_hash`),
    INDEX `workspace_invitations_workspace_id_accepted_at_idx`(`workspace_id`, `accepted_at`),
    INDEX `workspace_invitations_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `workspace_invitations` ADD CONSTRAINT `workspace_invitations_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspace_invitations` ADD CONSTRAINT `workspace_invitations_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
