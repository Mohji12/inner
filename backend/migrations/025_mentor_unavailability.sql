-- Coach time-off: one-off date ranges and repeating weekdays.
CREATE TABLE IF NOT EXISTS mentor_unavailability (
    id CHAR(36) NOT NULL PRIMARY KEY,
    mentor_id CHAR(36) NOT NULL,
    kind VARCHAR(16) NOT NULL,
    all_day TINYINT(1) NOT NULL DEFAULT 0,
    start_at_utc DATETIME(6) NULL,
    end_at_utc DATETIME(6) NULL,
    weekday INT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_mentor_unavailability_mentor_id (mentor_id),
    KEY idx_mentor_unavailability_mentor (mentor_id),
    CONSTRAINT fk_mentor_unavailability_mentor FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
