-- Email verification + OTP table (MySQL 8+)
-- Run after 001_initial_mentor_platform.sql

SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER account_status,
  ADD KEY idx_users_email_verified (email_verified);

ALTER TABLE mentors
  ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD KEY idx_mentors_email_verified (email_verified);

-- Existing rows: treat as already verified (avoid locking out current users)
UPDATE users SET email_verified = 1;
UPDATE mentors SET email_verified = 1;

CREATE TABLE IF NOT EXISTS email_otp_codes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL COMMENT 'user or mentor',
    subject_id CHAR(36) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_otp_role_email (role, email),
    KEY idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
