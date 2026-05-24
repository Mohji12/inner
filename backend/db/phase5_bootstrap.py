"""Ensure phase5 booking columns exist (idempotent; covers missed Alembic on this DB)."""

from sqlalchemy import text

from db.session import engine

_BOOKING_ALTER_SPECS: list[tuple[str, str]] = [
    ("reschedule_count", "ADD COLUMN `reschedule_count` INT NOT NULL DEFAULT 0"),
    ("reminder_24h_sent", "ADD COLUMN `reminder_24h_sent` TINYINT(1) NOT NULL DEFAULT 0"),
    ("reminder_1h_sent", "ADD COLUMN `reminder_1h_sent` TINYINT(1) NOT NULL DEFAULT 0"),
    ("reminder_15m_sent", "ADD COLUMN `reminder_15m_sent` TINYINT(1) NOT NULL DEFAULT 0"),
    ("no_show_by", "ADD COLUMN `no_show_by` VARCHAR(32) NULL"),
]


def ensure_phase5_booking_columns() -> None:
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'bookings'
                """
            )
        ).fetchall()
        existing = {r[0] for r in rows}
        for col, ddl in _BOOKING_ALTER_SPECS:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE bookings {ddl}"))
