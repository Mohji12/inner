"""Idempotent DDL for tables that deployments sometimes omit (manual SQL migrations not applied)."""

import logging
import time
import uuid

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from db.session import engine

logger = logging.getLogger(__name__)

# MySQL / MariaDB: ER_DUP_FIELDNAME (column already exists)
_DUP_COLUMN_ERRNO = 1060
_LOCK_WAIT_TIMEOUT_ERRNO = 1205


def _safe_add_column(ddl_sql: str) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(text(ddl_sql))
    except DBAPIError as e:
        code = getattr(e.orig, "args", (None,))[0]
        if code == _DUP_COLUMN_ERRNO:
            return
        raise


def ensure_mentors_banner_image_column() -> None:
    """Matches `models/mentor.py` — migration 011 sometimes not applied on prod DBs."""
    ddl = text("ALTER TABLE mentors ADD COLUMN banner_image VARCHAR(512) NULL")
    try:
        with engine.begin() as conn:
            conn.execute(ddl)
    except DBAPIError as e:
        code = getattr(e.orig, "args", (None,))[0]
        if code == _DUP_COLUMN_ERRNO:
            return
        raise


def ensure_mentor_kvk_number_column() -> None:
    """Chamber of Commerce (KVK) number for coach onboarding."""
    _safe_add_column("ALTER TABLE mentors ADD COLUMN kvk_number VARCHAR(32) NULL")


def ensure_mentor_public_card_visibility_column() -> None:
    """Coach-controlled visibility of profile fields on public browse cards."""
    _safe_add_column("ALTER TABLE mentors ADD COLUMN public_card_visibility JSON NULL")


def ensure_localization_i18n_columns() -> None:
    """Safety net for migration 015 (DB-backed localization columns)."""
    _safe_add_column("ALTER TABLE mentors ADD COLUMN headline_i18n JSON NULL")
    _safe_add_column("ALTER TABLE mentors ADD COLUMN bio_i18n JSON NULL")
    _safe_add_column("ALTER TABLE mentors ADD COLUMN agreement_text_snapshot_i18n JSON NULL")

    _safe_add_column("ALTER TABLE bookings ADD COLUMN session_topic_i18n JSON NULL")
    _safe_add_column("ALTER TABLE bookings ADD COLUMN problem_description_i18n JSON NULL")
    _safe_add_column("ALTER TABLE bookings ADD COLUMN goals_expected_i18n JSON NULL")
    _safe_add_column("ALTER TABLE bookings ADD COLUMN notes_by_user_i18n JSON NULL")
    _safe_add_column("ALTER TABLE bookings ADD COLUMN notes_by_mentor_i18n JSON NULL")

    _safe_add_column("ALTER TABLE reviews ADD COLUMN review_text_i18n JSON NULL")
    _safe_add_column("ALTER TABLE chat_messages ADD COLUMN body_i18n JSON NULL")

    _safe_add_column("ALTER TABLE notifications ADD COLUMN title_i18n JSON NULL")
    _safe_add_column("ALTER TABLE notifications ADD COLUMN body_i18n JSON NULL")


def ensure_chat_session_join_timer_columns() -> None:
    """Dual-join timer fields for booking-linked chat sessions."""
    _safe_add_column("ALTER TABLE chat_sessions ADD COLUMN allocated_duration_minutes INT NULL")
    _safe_add_column("ALTER TABLE chat_sessions ADD COLUMN user_joined_at DATETIME(6) NULL")
    _safe_add_column("ALTER TABLE chat_sessions ADD COLUMN mentor_joined_at DATETIME(6) NULL")
    _safe_add_column("ALTER TABLE chat_sessions ADD COLUMN timer_started_at DATETIME(6) NULL")


def backfill_booking_linked_chat_sessions() -> None:
    """Ensure paid booking chat sessions use dual-join timer fields (not legacy countdown)."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE chat_sessions cs
                INNER JOIN bookings b ON b.meeting_link LIKE CONCAT('%/chat/', cs.id, '%')
                SET cs.allocated_duration_minutes = COALESCE(cs.allocated_duration_minutes, b.duration)
                WHERE cs.allocated_duration_minutes IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE chat_sessions cs
                INNER JOIN bookings b ON b.meeting_link LIKE CONCAT('%/chat/', cs.id, '%')
                SET cs.ends_at = DATE_ADD(COALESCE(cs.updated_at, cs.created_at), INTERVAL 30 MINUTE)
                WHERE cs.timer_started_at IS NULL
                  AND cs.status != 'ended'
                  AND cs.allocated_duration_minutes IS NOT NULL
                  AND TIMESTAMPDIFF(MINUTE, cs.created_at, cs.ends_at) <= cs.allocated_duration_minutes
                """
            )
        )


def ensure_platform_pricing_table() -> None:
    from decimal import Decimal

    from core.config import settings

    rate = Decimal(str(settings.session_price_eur_per_minute))
    p5 = rate * Decimal(5)
    p10 = rate * Decimal(10)
    p20 = rate * Decimal(20)
    p30 = rate * Decimal(30)
    tier = {"p5": p5, "p10": p10, "p20": p20, "p30": p30}

    ddl = """
    CREATE TABLE IF NOT EXISTS platform_pricing (
        id CHAR(36) NOT NULL PRIMARY KEY,
        price_5_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        price_10_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        price_20_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        price_30_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        price_60_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """
    with engine.begin() as conn:
        conn.execute(text(ddl))
        n = conn.execute(text("SELECT COUNT(*) FROM platform_pricing")).scalar_one()
        params = {"id": str(uuid.uuid4()), **tier}
        if n == 0:
            conn.execute(
                text(
                    """
                    INSERT INTO platform_pricing (
                        id, price_5_min, price_10_min, price_20_min, price_30_min,
                        currency, is_active, created_at, updated_at
                    ) VALUES (
                        :id, :p5, :p10, :p20, :p30, 'EUR', 1,
                        CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
                    )
                    """
                ),
                params,
            )
        else:
            conn.execute(
                text(
                    """
                    UPDATE platform_pricing SET
                      price_5_min = :p5,
                      price_10_min = :p10,
                      price_20_min = :p20,
                      price_30_min = :p30,
                      currency = 'EUR',
                      is_active = 1,
                      updated_at = CURRENT_TIMESTAMP(6)
                    WHERE price_5_min = 0 AND price_10_min = 0
                      AND price_20_min = 0 AND price_30_min = 0
                    """
                ),
                tier,
            )


def _mysql_errno(exc: DBAPIError) -> int | None:
    orig = getattr(exc, "orig", None)
    args = getattr(orig, "args", ())
    if args:
        return args[0]
    return None


def ensure_legacy_public_pricing_upgraded() -> None:
    """When DB still has old €0.10/min tiers and coaches, align to `settings.session_price_eur_per_minute`."""
    from decimal import Decimal

    from core.config import settings

    rate = Decimal(str(settings.session_price_eur_per_minute))
    p5 = rate * Decimal(5)
    p10 = rate * Decimal(10)
    p20 = rate * Decimal(20)
    p30 = rate * Decimal(30)
    p60 = rate * Decimal(60)
    params = {
        "p5": str(p5.quantize(Decimal("0.01"))),
        "p10": str(p10.quantize(Decimal("0.01"))),
        "p20": str(p20.quantize(Decimal("0.01"))),
        "p30": str(p30.quantize(Decimal("0.01"))),
        "p60": str(p60.quantize(Decimal("0.01"))),
        "chat": str(rate.quantize(Decimal("0.01"))),
    }
    legacy_tiers = text(
        """
        UPDATE platform_pricing SET
          price_5_min = :p5,
          price_10_min = :p10,
          price_20_min = :p20,
          price_30_min = :p30,
          price_60_min = :p60,
          currency = 'EUR',
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP(6)
        WHERE price_5_min = 0.50 AND price_10_min = 1.00
          AND price_20_min = 2.00 AND price_30_min = 3.00
        """
    )
    legacy_chat = text(
        """
        UPDATE mentors SET chat_price_per_minute = :chat, updated_at = CURRENT_TIMESTAMP(6)
        WHERE chat_price_per_minute = 0.10
        """
    )

    with engine.connect() as conn:
        legacy_tier_rows = conn.execute(
            text(
                """
                SELECT COUNT(*) FROM platform_pricing
                WHERE price_5_min = 0.50 AND price_10_min = 1.00
                  AND price_20_min = 2.00 AND price_30_min = 3.00
                """
            )
        ).scalar_one()
        legacy_chat_rows = conn.execute(
            text("SELECT COUNT(*) FROM mentors WHERE chat_price_per_minute = 0.10")
        ).scalar_one()

    if legacy_tier_rows == 0 and legacy_chat_rows == 0:
        return

    for attempt in range(4):
        try:
            with engine.begin() as conn:
                if legacy_tier_rows:
                    conn.execute(legacy_tiers, params)
                if legacy_chat_rows:
                    conn.execute(legacy_chat, {"chat": params["chat"]})
            return
        except DBAPIError as e:
            if _mysql_errno(e) == _LOCK_WAIT_TIMEOUT_ERRNO and attempt < 3:
                time.sleep(0.25 * (2**attempt))
                continue
            if _mysql_errno(e) == _LOCK_WAIT_TIMEOUT_ERRNO:
                logger.warning(
                    "Skipping legacy pricing upgrade: mentors/platform_pricing locked (MySQL 1205). "
                    "Kill stuck DB transactions or restart MySQL, then restart the API."
                )
                return
            raise


def ensure_platform_pricing_60_min_column() -> None:
    """Add 60-minute session tier to platform_pricing and backfill from config or 2×30 min."""
    from decimal import Decimal

    from core.config import settings

    _safe_add_column("ALTER TABLE platform_pricing ADD COLUMN price_60_min DECIMAL(10,2) NOT NULL DEFAULT 0.00")
    rate = Decimal(str(settings.session_price_eur_per_minute))
    p60 = str((rate * Decimal(60)).quantize(Decimal("0.01")))
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE platform_pricing
                SET price_60_min = :p60
                WHERE price_60_min = 0
                """
            ),
            {"p60": p60},
        )
        conn.execute(
            text(
                """
                UPDATE platform_pricing
                SET price_60_min = ROUND(price_30_min * 2, 2)
                WHERE price_60_min = 0 AND price_30_min > 0
                """
            )
        )


def ensure_mentor_mollie_fee_tables() -> None:
    """Matches `migrations/010_mollie_mentor_fees.sql` — often skipped on local DBs."""
    onboarding = """
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """
    monthly = """
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """
    with engine.begin() as conn:
        conn.execute(text(onboarding))
        conn.execute(text(monthly))


def ensure_marketplace_ledger_tables() -> None:
    """Safety net for migration 018_marketplace_ledger_connect.sql."""
    ddls = [
        """
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
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
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS wallet_accounts (
            id CHAR(36) NOT NULL PRIMARY KEY,
            owner_type VARCHAR(16) NOT NULL,
            owner_id CHAR(36) NOT NULL,
            account_kind VARCHAR(32) NOT NULL,
            currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
            UNIQUE KEY uq_wallet_account_owner_kind_currency (owner_type, owner_id, account_kind, currency)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS ledger_transactions (
            id CHAR(36) NOT NULL PRIMARY KEY,
            txn_type VARCHAR(64) NOT NULL,
            reference_type VARCHAR(64) NULL,
            reference_id VARCHAR(128) NULL,
            idempotency_key VARCHAR(128) NULL,
            metadata_json JSON NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            UNIQUE KEY uq_ledger_txn_idempotency (idempotency_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
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
            KEY idx_wallet_holds_user_status (user_id, status),
            CONSTRAINT fk_wallet_holds_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_wallet_holds_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
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
            CONSTRAINT fk_session_billing_events_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
            CONSTRAINT fk_session_billing_events_hold FOREIGN KEY (hold_id) REFERENCES wallet_holds(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS coach_payout_attempts (
            id CHAR(36) NOT NULL PRIMARY KEY,
            payout_request_id CHAR(36) NOT NULL,
            attempt_no INT NOT NULL DEFAULT 1,
            provider_ref VARCHAR(255) NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'processing',
            error_message TEXT NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
            CONSTRAINT fk_coach_payout_attempts_request FOREIGN KEY (payout_request_id) REFERENCES coach_payout_requests(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
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
            UNIQUE KEY uq_webhook_provider_event_key (provider, event_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id CHAR(36) NOT NULL PRIMARY KEY,
            actor_role VARCHAR(16) NOT NULL,
            actor_id CHAR(36) NOT NULL,
            action VARCHAR(128) NOT NULL,
            entity_type VARCHAR(64) NOT NULL,
            entity_id VARCHAR(128) NOT NULL,
            details_json JSON NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
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
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ]
    with engine.begin() as conn:
        for ddl in ddls:
            conn.execute(text(ddl))
    _safe_add_column("ALTER TABLE coach_connect_accounts ADD COLUMN provider_account_label VARCHAR(255) NULL")
    _safe_add_column("ALTER TABLE coach_connect_accounts ADD COLUMN provider_account_masked VARCHAR(32) NULL")
    _safe_add_column("ALTER TABLE coach_connect_accounts ADD COLUMN connect_access_token TEXT NULL")
    _safe_add_column("ALTER TABLE coach_connect_accounts ADD COLUMN connect_refresh_token TEXT NULL")
    _safe_add_column("ALTER TABLE coach_connect_accounts ADD COLUMN connect_token_type VARCHAR(32) NULL")
    _safe_add_column("ALTER TABLE coach_connect_accounts ADD COLUMN connect_scope TEXT NULL")
    _safe_add_column("ALTER TABLE coach_connect_accounts ADD COLUMN connect_token_expires_at DATETIME(6) NULL")
    _safe_add_column("ALTER TABLE coach_connect_accounts ADD COLUMN capabilities_status VARCHAR(32) NULL")


def ensure_chat_billing_columns() -> None:
    """Matches migrations/020_chat_billing_tax_fee.sql when manual migrations were skipped."""
    _safe_add_column(
        "ALTER TABLE wallet_holds ADD COLUMN transaction_fee_charged TINYINT(1) NOT NULL DEFAULT 0"
    )
    _safe_add_column(
        "ALTER TABLE session_billing_events ADD COLUMN amount_tax DECIMAL(14,2) NOT NULL DEFAULT 0.00"
    )
    _safe_add_column(
        "ALTER TABLE session_billing_events ADD COLUMN amount_transaction_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00"
    )


def ensure_coach_applications_table() -> None:
    ddl = """
    CREATE TABLE IF NOT EXISTS coach_applications (
        id CHAR(36) NOT NULL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone_number VARCHAR(64) NOT NULL,
        headline VARCHAR(512) NOT NULL,
        motivation TEXT NOT NULL,
        years_of_experience INT NOT NULL DEFAULT 0,
        languages_spoken JSON NULL,
        website_or_social VARCHAR(512) NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'new',
        admin_notes TEXT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        KEY idx_coach_applications_email (email),
        KEY idx_coach_applications_status (status),
        KEY idx_coach_applications_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """
    with engine.begin() as conn:
        conn.execute(text(ddl))


def ensure_mentor_payout_bank_columns() -> None:
    """Matches migrations/022_mentor_payout_bank_columns.sql."""
    _safe_add_column("ALTER TABLE mentor_payout_accounts ADD COLUMN account_holder_name VARCHAR(255) NULL")
    _safe_add_column("ALTER TABLE mentor_payout_accounts ADD COLUMN iban VARCHAR(34) NULL")
    _safe_add_column("ALTER TABLE mentor_payout_accounts ADD COLUMN bic VARCHAR(11) NULL")


def ensure_onboarding_installment_columns() -> None:
    _safe_add_column(
        "ALTER TABLE mentor_onboarding_payments ADD COLUMN payment_plan VARCHAR(16) NOT NULL DEFAULT 'full'"
    )
    _safe_add_column(
        "ALTER TABLE mentor_onboarding_payments ADD COLUMN installment_number INT NOT NULL DEFAULT 1"
    )
    _safe_add_column(
        "ALTER TABLE mentor_onboarding_payments ADD COLUMN installment_total INT NOT NULL DEFAULT 1"
    )


def ensure_promo_code_scope_column() -> None:
    _safe_add_column("ALTER TABLE promo_codes ADD COLUMN scope VARCHAR(16) NOT NULL DEFAULT 'booking'")


def ensure_default_onboarding_promo_code() -> None:
    """Create the configured coach onboarding waiver promo if it does not exist."""
    from datetime import datetime, timezone

    from core.config import settings
    from core.security import new_uuid

    code = (settings.mentor_onboarding_promo_seed_code or "").strip().upper()
    if not code:
        return

    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT id, scope FROM promo_codes WHERE code = :code LIMIT 1"),
            {"code": code},
        ).first()
        if row:
            conn.execute(
                text(
                    "UPDATE promo_codes SET scope = 'onboarding', discount_type = 'percentage', "
                    "discount_value = 100.00, is_active = 1 WHERE code = :code AND scope != 'onboarding'"
                ),
                {"code": code},
            )
            return

        conn.execute(
            text(
                """
                INSERT INTO promo_codes (
                    id, code, discount_type, discount_value, scope, is_active, current_uses, first_time_only, created_at
                ) VALUES (
                    :id, :code, 'percentage', 100.00, 'onboarding', 1, 0, 0, :created_at
                )
                """
            ),
            {
                "id": new_uuid(),
                "code": code,
                "created_at": datetime.now(timezone.utc),
            },
        )


def ensure_universal_promo_codes() -> None:
    """Promos that should work for both session checkout and coach onboarding."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE promo_codes
                SET scope = 'all', is_active = 1
                WHERE UPPER(code) IN ('LIFE100')
                  AND scope IN ('booking', 'onboarding')
                """
            )
        )
