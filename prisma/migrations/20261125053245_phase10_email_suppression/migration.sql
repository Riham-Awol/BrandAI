-- AlterTable
ALTER TABLE `email_contacts` ADD COLUMN `suppression_reason` VARCHAR(20) NULL;

-- AlterTable
ALTER TABLE `email_deliveries` ADD COLUMN `provider_message_id` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `email_deliveries_provider_message_id_key` ON `email_deliveries`(`provider_message_id`);
