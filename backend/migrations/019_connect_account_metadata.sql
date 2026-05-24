-- Add Mollie Connect token/account metadata for real connected payouts.
SET NAMES utf8mb4;

ALTER TABLE coach_connect_accounts
    ADD COLUMN provider_account_label VARCHAR(255) NULL,
    ADD COLUMN provider_account_masked VARCHAR(32) NULL,
    ADD COLUMN connect_access_token TEXT NULL,
    ADD COLUMN connect_refresh_token TEXT NULL,
    ADD COLUMN connect_token_type VARCHAR(32) NULL,
    ADD COLUMN connect_scope TEXT NULL,
    ADD COLUMN connect_token_expires_at DATETIME(6) NULL,
    ADD COLUMN capabilities_status VARCHAR(32) NULL;
