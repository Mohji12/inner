-- Mollie migration: onboarding fee + monthly mentor invoices.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS mentor_onboarding_payments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    mentor_id CHAR(36) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    mollie_payment_id VARCHAR(128) NOT NULL,
    checkout_url TEXT NULL,
    metadata_json TEXT NULL,
    paid_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_mentor_onboarding_mollie_payment_id (mollie_payment_id),
    KEY idx_mentor_onboarding_mentor (mentor_id),
    CONSTRAINT fk_mentor_onboarding_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mentor_monthly_invoices (
    id CHAR(36) NOT NULL PRIMARY KEY,
    mentor_id CHAR(36) NOT NULL,
    invoice_month DATE NOT NULL,
    gross_revenue DECIMAL(12,2) NOT NULL,
    fee_percent DECIMAL(5,2) NOT NULL,
    fee_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    mollie_payment_id VARCHAR(128) NULL,
    mollie_checkout_url TEXT NULL,
    paid_at DATETIME(6) NULL,
    reminder_sent_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_mentor_monthly_invoice_month (mentor_id, invoice_month),
    UNIQUE KEY uq_mentor_monthly_invoice_mollie_payment_id (mollie_payment_id),
    KEY idx_mentor_monthly_invoice_status (status),
    CONSTRAINT fk_mentor_monthly_invoice_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
