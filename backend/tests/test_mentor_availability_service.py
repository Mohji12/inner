from services.mentor_availability_service import compute_chat_available, mentor_manual_occupied


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
    from unittest.mock import MagicMock

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = (True,)
    assert mentor_manual_occupied(db, "mentor-1") is True

    db.query.return_value.filter.return_value.first.return_value = (False,)
    assert mentor_manual_occupied(db, "mentor-1") is False

    db.query.return_value.filter.return_value.first.return_value = None
    assert mentor_manual_occupied(db, "mentor-1") is False
