-- Align legacy public UI data (platform session packages + per-coach chat rate).
-- Set @rate to your EUR per minute (e.g. 0.90), then run.

SET NAMES utf8mb4;

SET @rate = 0.90;

UPDATE platform_pricing SET
  price_5_min = ROUND(@rate * 5, 2),
  price_10_min = ROUND(@rate * 10, 2),
  price_20_min = ROUND(@rate * 20, 2),
  price_30_min = ROUND(@rate * 30, 2),
  currency = 'EUR',
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP(6)
WHERE price_5_min = 0.50 AND price_10_min = 1.00
  AND price_20_min = 2.00 AND price_30_min = 3.00;

UPDATE mentors SET chat_price_per_minute = @rate, updated_at = CURRENT_TIMESTAMP(6)
WHERE chat_price_per_minute = 0.10;
