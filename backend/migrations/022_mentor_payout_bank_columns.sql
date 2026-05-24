-- Bank details for coach share / manual transfers (complements Mollie Connect).

SET NAMES utf8mb4;

ALTER TABLE mentor_payout_accounts ADD COLUMN account_holder_name VARCHAR(255) NULL;
ALTER TABLE mentor_payout_accounts ADD COLUMN iban VARCHAR(34) NULL;
ALTER TABLE mentor_payout_accounts ADD COLUMN bic VARCHAR(11) NULL;
