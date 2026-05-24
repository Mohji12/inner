-- Full DB localization columns for user-facing text fields.
SET NAMES utf8mb4;

ALTER TABLE mentors
    ADD COLUMN headline_i18n JSON NULL AFTER headline,
    ADD COLUMN bio_i18n JSON NULL AFTER bio,
    ADD COLUMN agreement_text_snapshot_i18n JSON NULL AFTER agreement_text_snapshot;

UPDATE mentors
SET
    headline_i18n = CASE
        WHEN headline IS NULL OR headline = '' THEN NULL
        ELSE JSON_OBJECT('en', headline)
    END,
    bio_i18n = CASE
        WHEN bio IS NULL OR bio = '' THEN NULL
        ELSE JSON_OBJECT('en', bio)
    END,
    agreement_text_snapshot_i18n = CASE
        WHEN agreement_text_snapshot IS NULL OR agreement_text_snapshot = '' THEN NULL
        ELSE JSON_OBJECT('en', agreement_text_snapshot)
    END
WHERE headline_i18n IS NULL OR bio_i18n IS NULL OR agreement_text_snapshot_i18n IS NULL;

ALTER TABLE bookings
    ADD COLUMN session_topic_i18n JSON NULL AFTER session_topic,
    ADD COLUMN problem_description_i18n JSON NULL AFTER problem_description,
    ADD COLUMN goals_expected_i18n JSON NULL AFTER goals_expected,
    ADD COLUMN notes_by_user_i18n JSON NULL AFTER notes_by_user,
    ADD COLUMN notes_by_mentor_i18n JSON NULL AFTER notes_by_mentor;

UPDATE bookings
SET
    session_topic_i18n = CASE
        WHEN session_topic IS NULL OR session_topic = '' THEN NULL
        ELSE JSON_OBJECT('en', session_topic)
    END,
    problem_description_i18n = CASE
        WHEN problem_description IS NULL OR problem_description = '' THEN NULL
        ELSE JSON_OBJECT('en', problem_description)
    END,
    goals_expected_i18n = CASE
        WHEN goals_expected IS NULL OR goals_expected = '' THEN NULL
        ELSE JSON_OBJECT('en', goals_expected)
    END,
    notes_by_user_i18n = CASE
        WHEN notes_by_user IS NULL OR notes_by_user = '' THEN NULL
        ELSE JSON_OBJECT('en', notes_by_user)
    END,
    notes_by_mentor_i18n = CASE
        WHEN notes_by_mentor IS NULL OR notes_by_mentor = '' THEN NULL
        ELSE JSON_OBJECT('en', notes_by_mentor)
    END
WHERE
    session_topic_i18n IS NULL
    OR problem_description_i18n IS NULL
    OR goals_expected_i18n IS NULL
    OR notes_by_user_i18n IS NULL
    OR notes_by_mentor_i18n IS NULL;

ALTER TABLE reviews
    ADD COLUMN review_text_i18n JSON NULL AFTER review_text;

UPDATE reviews
SET review_text_i18n = CASE
    WHEN review_text IS NULL OR review_text = '' THEN NULL
    ELSE JSON_OBJECT('en', review_text)
END
WHERE review_text_i18n IS NULL;

ALTER TABLE chat_messages
    ADD COLUMN body_i18n JSON NULL AFTER body;

UPDATE chat_messages
SET body_i18n = CASE
    WHEN body IS NULL OR body = '' THEN NULL
    ELSE JSON_OBJECT('en', body)
END
WHERE body_i18n IS NULL;

ALTER TABLE notifications
    ADD COLUMN title_i18n JSON NULL AFTER title,
    ADD COLUMN body_i18n JSON NULL AFTER body;

UPDATE notifications
SET
    title_i18n = CASE
        WHEN title IS NULL OR title = '' THEN NULL
        ELSE JSON_OBJECT('en', title)
    END,
    body_i18n = CASE
        WHEN body IS NULL OR body = '' THEN NULL
        ELSE JSON_OBJECT('en', body)
    END
WHERE title_i18n IS NULL OR body_i18n IS NULL;
