-- Add timezone profile fields and UTC scheduling columns.
-- Assumption for backfill: legacy DATE/TIME values are already UTC.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NULL AFTER location;

ALTER TABLE mentors
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NULL AFTER phone_number,
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'UTC' AFTER country_code;

ALTER TABLE availability_slots
    ADD COLUMN IF NOT EXISTS start_at_utc DATETIME(6) NULL AFTER end_time,
    ADD COLUMN IF NOT EXISTS end_at_utc DATETIME(6) NULL AFTER start_at_utc;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS start_at_utc DATETIME(6) NULL AFTER end_time,
    ADD COLUMN IF NOT EXISTS end_at_utc DATETIME(6) NULL AFTER start_at_utc;

UPDATE availability_slots
SET
    start_at_utc = TIMESTAMP(slot_date, start_time),
    end_at_utc = TIMESTAMP(slot_date, end_time)
WHERE start_at_utc IS NULL OR end_at_utc IS NULL;

UPDATE bookings
SET
    start_at_utc = TIMESTAMP(booking_date, start_time),
    end_at_utc = TIMESTAMP(booking_date, end_time)
WHERE start_at_utc IS NULL OR end_at_utc IS NULL;

ALTER TABLE availability_slots
    MODIFY COLUMN start_at_utc DATETIME(6) NOT NULL,
    MODIFY COLUMN end_at_utc DATETIME(6) NOT NULL,
    ADD KEY IF NOT EXISTS idx_slots_mentor_start_utc_booked (mentor_id, start_at_utc, is_booked);

ALTER TABLE bookings
    MODIFY COLUMN start_at_utc DATETIME(6) NOT NULL,
    MODIFY COLUMN end_at_utc DATETIME(6) NOT NULL,
    ADD KEY IF NOT EXISTS idx_bookings_mentor_start_utc (mentor_id, start_at_utc),
    ADD KEY IF NOT EXISTS idx_bookings_user_start_utc (user_id, start_at_utc);
