-- Mentor Booking Platform — initial schema (MySQL 8+)
-- Run against database `therapy` (or your target DB).
-- UTF8MB4 for full Unicode support.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS availability_slots;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS mentors;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_image VARCHAR(512) NULL,
    gender VARCHAR(32) NULL,
    date_of_birth DATE NULL,
    location VARCHAR(255) NULL,
    timezone VARCHAR(64) NULL DEFAULT 'UTC',
    preferred_language VARCHAR(32) NOT NULL DEFAULT 'en',
    interests JSON NULL,
    goals TEXT NULL,
    preferred_categories JSON NULL,
    preferred_communication_mode VARCHAR(64) NULL,
    last_login DATETIME(6) NULL,
    account_status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_users_email (email),
    UNIQUE KEY uk_users_phone (phone_number),
    KEY idx_users_account_status (account_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mentors (
    id CHAR(36) NOT NULL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(64) NOT NULL,
    country_code VARCHAR(2) NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    password_hash VARCHAR(255) NOT NULL,
    profile_image VARCHAR(512) NULL,
    headline VARCHAR(512) NULL,
    bio TEXT NULL,
    languages_spoken JSON NULL,
    years_of_experience INT NOT NULL DEFAULT 0,
    current_company VARCHAR(255) NULL,
    previous_companies JSON NULL,
    education JSON NULL,
    certifications JSON NULL,
    expertise_areas JSON NULL,
    skills JSON NULL,
    tools_technologies JSON NULL,
    session_modes JSON NULL,
    price_10_min DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_20_min DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_30_min DECIMAL(10,2) NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_reviews INT NOT NULL DEFAULT 0,
    total_sessions_completed INT NOT NULL DEFAULT 0,
    is_verified TINYINT(1) NOT NULL DEFAULT 0,
    is_approved TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_mentors_email (email),
    UNIQUE KEY uk_mentors_phone (phone_number),
    KEY idx_mentors_status_approved (status, is_approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
    id CHAR(36) NOT NULL PRIMARY KEY,
    subject_id CHAR(36) NOT NULL,
    role VARCHAR(16) NOT NULL COMMENT 'user or mentor',
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_refresh_subject (subject_id, role),
    KEY idx_refresh_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE availability_slots (
    id CHAR(36) NOT NULL PRIMARY KEY,
    mentor_id CHAR(36) NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    start_at_utc DATETIME(6) NOT NULL,
    end_at_utc DATETIME(6) NOT NULL,
    slot_duration INT NOT NULL COMMENT 'minutes',
    is_booked TINYINT(1) NOT NULL DEFAULT 0,
    is_recurring TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_slots_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
    KEY idx_slots_mentor_date_booked (mentor_id, slot_date, is_booked),
    KEY idx_slots_mentor_start_utc_booked (mentor_id, start_at_utc, is_booked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    mentor_id CHAR(36) NOT NULL,
    slot_id CHAR(36) NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    start_at_utc DATETIME(6) NOT NULL,
    end_at_utc DATETIME(6) NOT NULL,
    duration INT NOT NULL,
    session_topic VARCHAR(512) NULL,
    problem_description TEXT NULL,
    goals_expected TEXT NULL,
    experience_level VARCHAR(64) NULL,
    communication_mode VARCHAR(64) NULL,
    urgency_level VARCHAR(32) NULL,
    preferred_language VARCHAR(32) NULL,
    attachments JSON NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'unpaid',
    payment_id VARCHAR(255) NULL,
    meeting_link VARCHAR(512) NULL,
    notes_by_user TEXT NULL,
    notes_by_mentor TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_slot FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE CASCADE,
    UNIQUE KEY uk_bookings_slot_id (slot_id),
    KEY idx_bookings_user (user_id),
    KEY idx_bookings_mentor (mentor_id),
    KEY idx_bookings_status (status),
    KEY idx_bookings_mentor_start_utc (mentor_id, start_at_utc),
    KEY idx_bookings_user_start_utc (user_id, start_at_utc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    booking_id CHAR(36) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    payment_gateway VARCHAR(64) NOT NULL DEFAULT 'placeholder',
    transaction_id VARCHAR(255) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    UNIQUE KEY uk_payments_transaction (transaction_id),
    KEY idx_payments_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    mentor_id CHAR(36) NOT NULL,
    booking_id CHAR(36) NOT NULL,
    rating INT NOT NULL,
    review_text TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    UNIQUE KEY uk_reviews_booking (booking_id),
    KEY idx_reviews_mentor (mentor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
