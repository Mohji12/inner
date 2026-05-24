-- Marketplace ledger, connect onboarding, payout orchestration, webhook/audit.
-- Incremental migration; safe to run after 017_enable_chat_for_existing_mentors.sql.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS capability_matrix (
    id CHAR(36) NOT NULL PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    supports_connect TINYINT(1) NOT NULL DEFAULT 0,
    supports_payouts TINYINT(1) NOT NULL DEFAULT 0,
    supports_transfers TINYINT(1) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_capability_matrix_country_entity_currency (country_code, entity_type, currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commission_configs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    scope VARCHAR(32) NOT NULL DEFAULT 'global',
    scope_ref VARCHAR(64) NULL,
    country_code VARCHAR(2) NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    percent DECIMAL(6,3) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    effective_from DATETIME(6) NOT NULL,
    effective_to DATETIME(6) NULL,
    created_by_admin CHAR(36) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_commission_active_time (is_active, effective_from, effective_to),
    KEY idx_commission_scope (scope, scope_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_accounts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    owner_type VARCHAR(16) NOT NULL,
    owner_id CHAR(36) NOT NULL,
    account_kind VARCHAR(32) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_wallet_account_owner_kind_currency (owner_type, owner_id, account_kind, currency),
    KEY idx_wallet_account_owner (owner_type, owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ledger_transactions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    txn_type VARCHAR(64) NOT NULL,
    reference_type VARCHAR(64) NULL,
    reference_id VARCHAR(128) NULL,
    idempotency_key VARCHAR(128) NULL,
    metadata_json JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_ledger_txn_idempotency (idempotency_key),
    KEY idx_ledger_txn_ref (reference_type, reference_id),
    KEY idx_ledger_txn_type (txn_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ledger_entries (
    id CHAR(36) NOT NULL PRIMARY KEY,
    transaction_id CHAR(36) NOT NULL,
    wallet_account_id CHAR(36) NOT NULL,
    direction VARCHAR(16) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    memo VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_ledger_entries_txn (transaction_id),
    KEY idx_ledger_entries_account (wallet_account_id),
    CONSTRAINT fk_ledger_entries_txn FOREIGN KEY (transaction_id) REFERENCES ledger_transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_ledger_entries_account FOREIGN KEY (wallet_account_id) REFERENCES wallet_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_holds (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    session_id CHAR(36) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    amount_reserved DECIMAL(14,2) NOT NULL,
    amount_consumed DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_wallet_holds_session_active (session_id, status),
    KEY idx_wallet_holds_user_status (user_id, status),
    CONSTRAINT fk_wallet_holds_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_wallet_holds_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_billing_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    hold_id CHAR(36) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    seconds_billed INT NOT NULL DEFAULT 0,
    amount_gross DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    amount_commission DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    amount_coach_net DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_session_billing_events_session (session_id, created_at),
    KEY idx_session_billing_events_hold (hold_id, created_at),
    CONSTRAINT fk_session_billing_events_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_billing_events_hold FOREIGN KEY (hold_id) REFERENCES wallet_holds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coach_connect_accounts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    mentor_id CHAR(36) NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'mollie',
    provider_account_id VARCHAR(128) NULL,
    provider_account_label VARCHAR(255) NULL,
    provider_account_masked VARCHAR(32) NULL,
    onboarding_state VARCHAR(32) NOT NULL DEFAULT 'not_started',
    kyc_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    payouts_enabled TINYINT(1) NOT NULL DEFAULT 0,
    connect_access_token TEXT NULL,
    connect_refresh_token TEXT NULL,
    connect_token_type VARCHAR(32) NULL,
    connect_scope TEXT NULL,
    connect_token_expires_at DATETIME(6) NULL,
    capabilities_status VARCHAR(32) NULL,
    capabilities_json JSON NULL,
    tax_country VARCHAR(2) NULL,
    tax_type VARCHAR(32) NULL,
    onboarding_redirect_url TEXT NULL,
    last_synced_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_coach_connect_mentor (mentor_id),
    UNIQUE KEY uq_coach_connect_provider_account (provider_account_id),
    CONSTRAINT fk_coach_connect_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coach_payout_requests (
    id CHAR(36) NOT NULL PRIMARY KEY,
    mentor_id CHAR(36) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    amount DECIMAL(14,2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'requested',
    requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    approved_by_admin_id CHAR(36) NULL,
    processed_at DATETIME(6) NULL,
    failure_reason TEXT NULL,
    idempotency_key VARCHAR(128) NULL,
    KEY idx_coach_payout_requests_mentor_status (mentor_id, status),
    UNIQUE KEY uq_coach_payout_requests_idempotency (idempotency_key),
    CONSTRAINT fk_coach_payout_requests_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
    CONSTRAINT fk_coach_payout_requests_admin FOREIGN KEY (approved_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coach_payout_attempts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    payout_request_id CHAR(36) NOT NULL,
    attempt_no INT NOT NULL DEFAULT 1,
    provider_ref VARCHAR(255) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'processing',
    error_message TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY idx_coach_payout_attempts_request (payout_request_id, attempt_no),
    CONSTRAINT fk_coach_payout_attempts_request FOREIGN KEY (payout_request_id) REFERENCES coach_payout_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_event_logs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    event_key VARCHAR(255) NOT NULL,
    event_type VARCHAR(64) NULL,
    signature_valid TINYINT(1) NOT NULL DEFAULT 0,
    payload_hash VARCHAR(128) NOT NULL,
    payload_json JSON NULL,
    processing_status VARCHAR(32) NOT NULL DEFAULT 'received',
    error_message TEXT NULL,
    received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at DATETIME(6) NULL,
    UNIQUE KEY uq_webhook_provider_event_key (provider, event_key),
    KEY idx_webhook_provider_status (provider, processing_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    actor_role VARCHAR(16) NOT NULL,
    actor_id CHAR(36) NOT NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    details_json JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_audit_entity (entity_type, entity_id),
    KEY idx_audit_actor (actor_role, actor_id),
    KEY idx_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outbox_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    payload_json JSON NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at DATETIME(6) NULL,
    error_message TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_outbox_pending (status, available_at),
    KEY idx_outbox_aggregate (aggregate_type, aggregate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
