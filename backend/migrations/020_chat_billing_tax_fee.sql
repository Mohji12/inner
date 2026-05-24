-- Chat ledger: per-hold transaction fee flag; session billing tax + transaction fee columns.
-- Run after 018_marketplace_ledger_connect.sql.

SET NAMES utf8mb4;

ALTER TABLE wallet_holds ADD COLUMN transaction_fee_charged TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE session_billing_events ADD COLUMN amount_tax DECIMAL(14,2) NOT NULL DEFAULT 0.00;

ALTER TABLE session_billing_events ADD COLUMN amount_transaction_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00;
