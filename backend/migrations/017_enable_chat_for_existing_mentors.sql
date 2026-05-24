-- Enable text chat by default for existing mentors.
-- Keeps already-configured positive prices unchanged.

UPDATE mentors
SET
    chat_price_per_minute = CASE
        WHEN chat_price_per_minute IS NULL OR chat_price_per_minute <= 0 THEN 0.10
        ELSE chat_price_per_minute
    END,
    chat_currency = CASE
        WHEN chat_currency IS NULL OR chat_currency = '' THEN 'EUR'
        ELSE chat_currency
    END,
    chat_min_purchase_minutes = CASE
        WHEN chat_min_purchase_minutes IS NULL OR chat_min_purchase_minutes < 1 THEN 1
        ELSE chat_min_purchase_minutes
    END;
