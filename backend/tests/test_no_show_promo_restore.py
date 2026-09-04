from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from services.live_session_service import booking_was_coach_no_show, classify_booking_no_show
from services.no_show_service import mark_booking_unattended


def _session(*, user=True, mentor=False, timer=False):
    s = MagicMock()
    now = datetime.now(timezone.utc)
    s.user_joined_at = now if user else None
    s.mentor_joined_at = now if mentor else None
    s.timer_started_at = now if timer else None
    return s


def test_classify_coach_no_show_when_user_joined_only():
    db = MagicMock()
    booking = MagicMock()
    with patch("services.live_session_service.chat_session_for_booking", return_value=_session(user=True, mentor=False)):
        assert classify_booking_no_show(db, booking) == "mentor"
        assert booking_was_coach_no_show(db, booking) is True


def test_classify_user_no_show_when_mentor_joined_only():
    db = MagicMock()
    booking = MagicMock()
    with patch("services.live_session_service.chat_session_for_booking", return_value=_session(user=False, mentor=True)):
        assert classify_booking_no_show(db, booking) == "user"
        assert booking_was_coach_no_show(db, booking) is False


def test_classify_both_no_show():
    db = MagicMock()
    booking = MagicMock()
    with patch("services.live_session_service.chat_session_for_booking", return_value=_session(user=False, mentor=False)):
        assert classify_booking_no_show(db, booking) == "both"
        assert booking_was_coach_no_show(db, booking) is False


def test_classify_none_when_timer_started():
    db = MagicMock()
    booking = MagicMock()
    with patch("services.live_session_service.chat_session_for_booking", return_value=_session(user=True, mentor=True, timer=True)):
        assert classify_booking_no_show(db, booking) is None
        assert booking_was_coach_no_show(db, booking) is False


def test_mark_booking_unattended_restores_promo_on_coach_miss():
    db = MagicMock()
    booking = MagicMock()
    booking.id = "booking-1"
    booking.status = "confirmed"
    booking.user_id = "user-1"
    booking.mentor_id = "mentor-1"
    booking.user.full_name = "User"
    booking.mentor.full_name = "Coach"

    with (
        patch("services.no_show_service.classify_booking_no_show", return_value="mentor"),
        patch("services.no_show_service.booking_was_coach_no_show", return_value=True),
        patch("services.no_show_service.reverse_promo_redemption_for_booking", return_value=True) as reverse,
        patch("services.no_show_service.create_notification"),
    ):
        assert mark_booking_unattended(db, booking) is True
        assert booking.status == "unattended"
        assert booking.no_show_by == "mentor"
        reverse.assert_called_once_with(db, "booking-1", commit=False)


def test_mark_booking_unattended_skips_promo_restore_when_user_missed():
    db = MagicMock()
    booking = MagicMock()
    booking.id = "booking-1"
    booking.status = "confirmed"
    booking.user_id = "user-1"
    booking.mentor_id = "mentor-1"
    booking.user.full_name = "User"
    booking.mentor.full_name = "Coach"

    with (
        patch("services.no_show_service.classify_booking_no_show", return_value="user"),
        patch("services.no_show_service.booking_was_coach_no_show", return_value=False),
        patch("services.no_show_service.reverse_promo_redemption_for_booking") as reverse,
        patch("services.no_show_service.create_notification"),
    ):
        assert mark_booking_unattended(db, booking) is True
        assert booking.no_show_by == "user"
        reverse.assert_not_called()
