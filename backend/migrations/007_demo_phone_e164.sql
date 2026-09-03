-- Optional: set demo seed accounts' phone numbers (E.164, India +91) for SIP / dial testing.
-- Run after 002_seed.sql. Safe to re-run (idempotent targets).

SET NAMES utf8mb4;

-- Demo user (user@example.com): 7676283924 → +917676283924
UPDATE users
SET phone_number = '+917676283924'
WHERE id = 'a0000000-0000-4000-8000-000000000001' OR email = 'user@example.com';

-- Demo mentor (mentor@example.com): 8625877312 → +918625877312
UPDATE mentors
SET phone_number = '+918625877312'
WHERE id = 'b0000000-0000-4000-8000-000000000002' OR email = 'mentor@example.com';
