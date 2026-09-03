-- Paid text chat: sessions, messages, purchases + mentor pricing (MySQL 8+)
-- Run after 003_email_otp_verification.sql (mentors.email_verified exists).

SET NAMES utf8mb4;

ALTER TABLE mentors
  ADD COLUMN chat_price_per_minute DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '0 disables chat' AFTER email_verified,
  ADD COLUMN chat_currency VARCHAR(8) NOT NULL DEFAULT 'EUR' AFTER chat_price_per_minute,
  ADD COLUMN chat_min_purchase_minutes INT NOT NULL DEFAULT 1 AFTER chat_currency;

CREATE TABLE IF NOT EXISTS chat_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    mentor_id CHAR(36) NOT NULL,
    status VARCHAR(32) NOT NULL COMMENT 'active paused ended',
    ends_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY idx_chat_sessions_mentor_status_ends (mentor_id, status, ends_at),
    KEY idx_chat_sessions_user (user_id),
    CONSTRAINT fk_chat_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_sessions_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
    id CHAR(36) NOT NULL PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    sender_role VARCHAR(16) NOT NULL COMMENT 'user or mentor',
    body TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_chat_messages_session_created (session_id, created_at),
    CONSTRAINT fk_chat_messages_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_purchases (
    id CHAR(36) NOT NULL PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    minutes INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    status VARCHAR(32) NOT NULL DEFAULT 'succeeded',
    transaction_id VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_chat_purchases_session (session_id),
    KEY idx_chat_purchases_user (user_id),
    CONSTRAINT fk_chat_purchases_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_purchases_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Demo mentor from 002_seed: enable paid chat for local testing
UPDATE mentors
SET chat_price_per_minute = 1.50, chat_currency = 'EUR', chat_min_purchase_minutes = 5
WHERE id = 'b0000000-0000-4000-8000-000000000002';
