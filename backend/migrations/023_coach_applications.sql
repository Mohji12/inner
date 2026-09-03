-- Coach interest / application submissions from the public become-a-coach page.

CREATE TABLE IF NOT EXISTS coach_applications (
    id CHAR(36) NOT NULL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(64) NOT NULL,
    headline VARCHAR(512) NOT NULL,
    motivation TEXT NOT NULL,
    years_of_experience INT NOT NULL DEFAULT 0,
    languages_spoken JSON NULL,
    website_or_social VARCHAR(512) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'new',
    admin_notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY idx_coach_applications_email (email),
    KEY idx_coach_applications_status (status),
    KEY idx_coach_applications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
