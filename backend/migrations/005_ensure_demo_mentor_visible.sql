-- Run after 002_seed.sql and 003_email_otp_verification.sql.
-- Ensures the demo mentor (and user) can log in and appear in the public directory.
-- Safe to run multiple times.

SET NAMES utf8mb4;

UPDATE mentors
SET status = 'active', is_approved = 1, email_verified = 1
WHERE id = 'b0000000-0000-4000-8000-000000000002' OR email = 'mentor@example.com';

UPDATE users
SET email_verified = 1
WHERE id = 'a0000000-0000-4000-8000-000000000001' OR email = 'user@example.com';
