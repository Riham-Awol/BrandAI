-- AlterTable
ALTER TABLE `projects` MODIFY `type` ENUM('LAUNCH_STUDIO', 'BRAND_STUDIO', 'STRATEGY_STUDIO', 'SOCIAL_STUDIO', 'COMPANY_PROFILE') NOT NULL;

-- CreateTable
CREATE TABLE `business_details` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `legal_name` VARCHAR(200) NULL,
    `address_line1` VARCHAR(200) NULL,
    `address_line2` VARCHAR(200) NULL,
    `city` VARCHAR(120) NULL,
    `postcode` VARCHAR(40) NULL,
    `country` VARCHAR(120) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `website` VARCHAR(300) NULL,
    `registration_number` VARCHAR(80) NULL,
    `tax_number` VARCHAR(80) NULL,
    `bank_details` TEXT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'GBP',
    `default_tax_rate_bp` INTEGER NOT NULL DEFAULT 0,
    `payment_terms_days` INTEGER NOT NULL DEFAULT 14,
    `invoice_prefix` VARCHAR(12) NOT NULL DEFAULT 'INV-',
    `quote_prefix` VARCHAR(12) NOT NULL DEFAULT 'QUO-',
    `next_invoice_number` INTEGER NOT NULL DEFAULT 1,
    `next_quote_number` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `business_details_business_id_key`(`business_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brand_materials` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `kind` ENUM('BUSINESS_CARD', 'LETTERHEAD', 'TSHIRT', 'UNIFORM', 'BAG', 'MUG', 'LABEL', 'PACKAGING') NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `spec` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `is_mock` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `brand_materials_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    INDEX `brand_materials_business_id_kind_idx`(`business_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brand_material_revisions` (
    `id` CHAR(36) NOT NULL,
    `material_id` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `spec` JSON NOT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `brand_material_revisions_material_id_version_key`(`material_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_documents` (
    `id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `type` ENUM('INVOICE', 'QUOTE') NOT NULL,
    `number` VARCHAR(40) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'PAID', 'ACCEPTED', 'DECLINED', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `customer` JSON NOT NULL,
    `issue_date` DATE NOT NULL,
    `due_date` DATE NULL,
    `currency` CHAR(3) NOT NULL,
    `lines` JSON NOT NULL,
    `intro` TEXT NULL,
    `notes` TEXT NULL,
    `terms` TEXT NULL,
    `subtotal_minor` BIGINT NOT NULL,
    `tax_minor` BIGINT NOT NULL,
    `total_minor` BIGINT NOT NULL,
    `source_quote_id` CHAR(36) NULL,
    `sent_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `business_documents_workspace_id_deleted_at_idx`(`workspace_id`, `deleted_at`),
    INDEX `business_documents_business_id_type_status_idx`(`business_id`, `type`, `status`),
    UNIQUE INDEX `business_documents_business_id_type_number_key`(`business_id`, `type`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `business_details` ADD CONSTRAINT `business_details_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_materials` ADD CONSTRAINT `brand_materials_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_materials` ADD CONSTRAINT `brand_materials_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_material_revisions` ADD CONSTRAINT `brand_material_revisions_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `brand_materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_documents` ADD CONSTRAINT `business_documents_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_documents` ADD CONSTRAINT `business_documents_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
