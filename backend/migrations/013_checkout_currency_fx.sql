-- Multi-currency Mollie checkout: EUR base reference + optional FX rate; monthly invoice checkout snapshot.
SET NAMES utf8mb4;

ALTER TABLE payments
    ADD COLUMN amount_base_eur DECIMAL(12,2) NULL AFTER amount,
    ADD COLUMN fx_rate_used DECIMAL(18,8) NULL AFTER currency;

ALTER TABLE chat_purchases
    ADD COLUMN amount_base_eur DECIMAL(12,2) NULL AFTER amount,
    ADD COLUMN fx_rate_used DECIMAL(18,8) NULL AFTER currency;

ALTER TABLE mentor_onboarding_payments
    ADD COLUMN amount_base_eur DECIMAL(12,2) NULL AFTER amount,
    ADD COLUMN fx_rate_used DECIMAL(18,8) NULL AFTER currency;

ALTER TABLE mentor_monthly_invoices
    ADD COLUMN checkout_amount DECIMAL(12,2) NULL AFTER fee_amount,
    ADD COLUMN checkout_currency VARCHAR(8) NULL AFTER checkout_amount,
    ADD COLUMN fee_fx_rate DECIMAL(18,8) NULL AFTER checkout_currency;
