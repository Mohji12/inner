-- Dev seed data (password for both sample user & mentor: Test1234!)
-- Run after 001_initial_mentor_platform.sql

SET NAMES utf8mb4;

INSERT INTO users (
  id, full_name, email, phone_number, password_hash,
  preferred_language, interests, goals, preferred_categories,
  account_status, created_at, updated_at
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Demo User',
  'user@example.com',
  '+917676283924',
  '$2b$12$rqfFGkj4blgPryzAG0MS2eOAb42t4NW9fwDKFEwABpRSCbOWpeOES',
  'en',
  JSON_ARRAY('spirituality', 'coaching'),
  'Find clarity and balance.',
  JSON_ARRAY('wellness', 'career'),
  'active',
  NOW(6), NOW(6)
);

INSERT INTO mentors (
  id, full_name, email, phone_number, password_hash,
  headline, bio, languages_spoken, years_of_experience,
  expertise_areas, skills, price_10_min, price_20_min, price_30_min,
  is_verified, is_approved, status, created_at, updated_at
) VALUES (
  'b0000000-0000-4000-8000-000000000002',
  'Demo Mentor',
  'mentor@example.com',
  '+918625877312',
  '$2b$12$rqfFGkj4blgPryzAG0MS2eOAb42t4NW9fwDKFEwABpRSCbOWpeOES',
  'Spiritual coach & energy guide',
  'I help clients reconnect with their inner path through coaching and energy work.',
  JSON_ARRAY('en', 'nl'),
  8,
  JSON_ARRAY('Life coaching', 'Meditation'),
  JSON_ARRAY('Active listening', 'Energy work'),
  20.00, 35.00, 50.00,
  1, 1, 'active',
  NOW(6), NOW(6)
);

INSERT INTO availability_slots (
  id, mentor_id, slot_date, start_time, end_time, slot_duration, is_booked, is_recurring, created_at
) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', DATE_ADD(CURDATE(), INTERVAL 3 DAY), '10:00:00', '10:30:00', 30, 0, 0, NOW(6)),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', DATE_ADD(CURDATE(), INTERVAL 3 DAY), '14:00:00', '14:20:00', 20, 0, 0, NOW(6)),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', DATE_ADD(CURDATE(), INTERVAL 5 DAY), '09:00:00', '09:10:00', 10, 0, 0, NOW(6));
