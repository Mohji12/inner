-- Admin-managed wallet operations and 15-day mentor settlements.
-- Run after 008_chat_bridge_sessions.sql.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS mentor_payout_accounts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    mentor_id CHAR(36) NOT NULL,
    provider_name VARCHAR(64) NOT NULL,
    provider_account_ref VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    verified_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_mentor_payout_accounts_mentor_id (mentor_id),
    CONSTRAINT fk_mentor_payout_accounts_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mentor_settlements (
    id CHAR(36) NOT NULL PRIMARY KEY,
    mentor_id CHAR(36) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    cycle_start DATE NOT NULL,
    cycle_end DATE NOT NULL,
    gross_amount DECIMAL(12,2) NOT NULL,
    fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_by_admin CHAR(36) NOT NULL,
    approved_by_admin CHAR(36) NULL,
    provider_batch_ref VARCHAR(255) NULL,
    failure_reason TEXT NULL,
    paid_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY idx_mentor_settlements_mentor_status (mentor_id, status),
    KEY idx_mentor_settlements_cycle (cycle_start, cycle_end),
    KEY idx_mentor_settlements_created_admin (created_by_admin),
    KEY idx_mentor_settlements_approved_admin (approved_by_admin),
    CONSTRAINT fk_mentor_settlements_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
    CONSTRAINT fk_mentor_settlements_created_admin FOREIGN KEY (created_by_admin) REFERENCES admins(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mentor_settlements_approved_admin FOREIGN KEY (approved_by_admin) REFERENCES admins(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mentor_settlement_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    settlement_id CHAR(36) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_id CHAR(36) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_mentor_settlement_items_settlement (settlement_id),
    UNIQUE KEY uq_mentor_settlement_source (source_type, source_id),
    CONSTRAINT fk_mentor_settlement_items_settlement FOREIGN KEY (settlement_id) REFERENCES mentor_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS admin_actor_id CHAR(36) NULL AFTER reference_id,
    ADD COLUMN IF NOT EXISTS admin_actor_role VARCHAR(16) NULL AFTER admin_actor_id,
    ADD INDEX IF NOT EXISTS idx_wallet_transactions_admin_actor (admin_actor_id);
