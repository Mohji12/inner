-- Default session duration prices (admin-configurable). Matches `models/platform_pricing.py`.
-- Run on `therapy` after prior migrations. Idempotent insert: only seeds if table is empty.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS platform_pricing (
    id CHAR(36) NOT NULL PRIMARY KEY,
    price_5_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_10_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_20_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_30_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default tiers: EUR 0.10/min ⇒ 0.50 / 1.00 / 2.00 / 3.00 (is_active enables Mollie checkout).
INSERT INTO platform_pricing (
    id, price_5_min, price_10_min, price_20_min, price_30_min, currency, is_active, created_at, updated_at
)
SELECT
    UUID(),
    0.50,
    1.00,
    2.00,
    3.00,
    'EUR',
    1,
    CURRENT_TIMESTAMP(6),
    CURRENT_TIMESTAMP(6)
FROM (SELECT 1 AS _) AS dummy
WHERE NOT EXISTS (SELECT 1 FROM platform_pricing LIMIT 1);
