-- Admin accounts for dashboard (MySQL 8+)
-- Dummy dev login: see backend/README.md (password not stored in app source)

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS admins (
    id CHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password: Admin123! (bcrypt hash generated for this seed only)
INSERT IGNORE INTO admins (id, email, password_hash, created_at, updated_at) VALUES (
    'd0000000-0000-4000-8000-000000000099',
    'admin@example.com',
    '$2b$12$lNa/MSoq9c2qDTPchOTPCOctqTZnstqZpUWKV3EqI2Q9DVfVfxCCC',
    NOW(6),
    NOW(6)
);


