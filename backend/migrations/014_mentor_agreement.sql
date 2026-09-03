-- Coach agreement proof fields on mentors.
SET NAMES utf8mb4;

ALTER TABLE mentors
    ADD COLUMN agreement_accepted_at DATETIME(6) NULL AFTER chat_min_purchase_minutes,
    ADD COLUMN agreement_version VARCHAR(64) NULL AFTER agreement_accepted_at,
    ADD COLUMN agreement_text_snapshot TEXT NULL AFTER agreement_version;

