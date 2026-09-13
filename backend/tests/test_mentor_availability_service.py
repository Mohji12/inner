from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from services.mentor_availability_service import (
    compute_chat_available,
    live_availability_block_reason,
    mentor_is_occupied,
    mentor_manual_occupied,
)


def test_compute_chat_available_when_occupied():
    assert not compute_chat_available(
        online=True,
        busy=False,
        unavailable_schedule=False,
        manual_occupied=True,
    )


def test_compute_chat_available_when_online():
    assert compute_chat_available(
        online=True,
        busy=False,
        unavailable_schedule=False,
        manual_occupied=False,
    )


def test_mentor_manual_occupied_reads_flag():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = (True,)
    assert mentor_manual_occupied(db, "mentor-1") is True

    db.query.return_value.filter.return_value.first.return_value = (False,)
    assert mentor_manual_occupied(db, "mentor-1") is False

    db.query.return_value.filter.return_value.first.return_value = None
    assert mentor_manual_occupied(db, "mentor-1") is False


def test_mentor_is_occupied_from_presence_mode():
    mentor = SimpleNamespace(presence_mode="paused", manual_occupied=False)
    assert mentor_is_occupied(mentor) is True
    mentor = SimpleNamespace(presence_mode="online", manual_occupied=False)
    assert mentor_is_occupied(mentor) is False
    mentor = SimpleNamespace(presence_mode="online", manual_occupied=True)
    assert mentor_is_occupied(mentor) is True


def test_live_availability_uses_effective_online_not_raw_heartbeat():
    db = MagicMock()
    mentor = SimpleNamespace(
        id="m1",
        is_approved=True,
        status="active",
        presence_mode="offline",
        manual_occupied=False,
        last_seen_at=None,
    )
    with (
        patch("services.chat_service.mentor_chat_busy", return_value=False),
        patch(
            "services.mentor_presence_mode_service.effective_is_online",
            return_value=False,
        ) as eff,
        patch(
            "services.presence_service.presence_service.is_online",
            return_value=True,
        ),
        patch(
            "services.mentor_unavailability_service.mentor_unavailable_now",
            return_value=False,
        ),
    ):
        assert live_availability_block_reason(db, mentor) == "mentor_offline"
        eff.assert_called_once()


def test_live_availability_blocks_occupied_mode():
    db = MagicMock()
    mentor = SimpleNamespace(
        id="m1",
        is_approved=True,
        status="active",
        presence_mode="occupied",
        manual_occupied=True,
        last_seen_at=None,
    )
    with (
        patch("services.chat_service.mentor_chat_busy", return_value=False),
        patch(
            "services.mentor_presence_mode_service.effective_is_online",
            return_value=True,
        ),
        patch(
            "services.mentor_unavailability_service.mentor_unavailable_now",
            return_value=False,
        ),
    ):
        assert live_availability_block_reason(db, mentor) == "mentor_occupied"
