-- Optional alignment after deploying new defaults (run once on existing DBs).
-- Review before applying: chat rate, global EUR commission, platform_pricing tiers.

SET NAMES utf8mb4;

UPDATE mentors SET chat_price_per_minute = 0.90 WHERE chat_price_per_minute = 0.10;

UPDATE commission_configs
SET percent = 30.000
WHERE scope = 'global'
  AND currency = 'EUR'
  AND is_active = 1
  AND percent = 20.000;
