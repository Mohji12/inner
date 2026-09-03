-- Phone-to-phone SIP bridge sessions for LiveKit outbound trunk calls.
-- Run after 006_chat.sql.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS chat_bridge_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    actor_role VARCHAR(16) NOT NULL COMMENT 'user mentor admin',
    actor_id CHAR(36) NOT NULL,
    number_a VARCHAR(32) NOT NULL,
    number_b VARCHAR(32) NOT NULL,
    label_a VARCHAR(64) NULL,
    label_b VARCHAR(64) NULL,
    room_name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'dialing' COMMENT 'dialing connected partial_failed failed',
    leg_a_participant_id VARCHAR(128) NULL,
    leg_a_sip_call_id VARCHAR(128) NULL,
    leg_b_participant_id VARCHAR(128) NULL,
    leg_b_sip_call_id VARCHAR(128) NULL,
    error_message TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_chat_bridge_room_name (room_name),
    KEY idx_chat_bridge_actor (actor_role, actor_id),
    KEY idx_chat_bridge_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
