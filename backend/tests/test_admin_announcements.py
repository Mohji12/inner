from unittest.mock import MagicMock, patch

from services.admin_announcement_service import broadcast_admin_announcement


def _user(*, user_id: str = "u1", email: str = "user@example.com", name: str = "Ada") -> MagicMock:
    u = MagicMock()
    u.id = user_id
    u.email = email
    u.full_name = name
    return u


def test_broadcast_to_one_user_creates_user_notification_and_email() -> None:
    db = MagicMock()
    user = _user()
    user_q = MagicMock()
    user_q.filter.return_value.first.return_value = user
    db.query.return_value = user_q

    with (
        patch("services.admin_announcement_service.create_notification") as create_notif,
        patch(
            "services.admin_announcement_service.send_plain_emails",
            return_value=(1, None),
        ) as send_mail,
        patch("services.admin_announcement_service.new_uuid", return_value="ann-1"),
    ):
        row, warning = broadcast_admin_announcement(
            db,
            admin_id="admin-1",
            title="Hello",
            body="Body text",
            send_email=True,
            audience="user",
            user_id="u1",
        )

    assert row.id == "ann-1"
    assert row.audience == "user"
    assert row.recipient_count == 1
    assert row.emails_sent == 1
    assert warning is None
    create_notif.assert_called_once()
    kwargs = dict(create_notif.call_args.kwargs)
    assert kwargs["user_id"] == "u1"
    assert "mentor_id" not in kwargs
    assert kwargs["link"] == "/user/dashboard"
    send_mail.assert_called_once()
    mail_items = send_mail.call_args.args[0]
    assert mail_items[0][0] == "user@example.com"


def test_broadcast_rejects_user_id_for_coach_audience() -> None:
    db = MagicMock()
    try:
        broadcast_admin_announcement(
            db,
            admin_id="admin-1",
            title="Hello",
            body="Body",
            audience="coach",
            user_id="u1",
        )
        assert False, "expected ValueError"
    except ValueError as e:
        assert "user_id" in str(e)


def test_broadcast_rejects_mentor_id_for_user_audience() -> None:
    db = MagicMock()
    try:
        broadcast_admin_announcement(
            db,
            admin_id="admin-1",
            title="Hello",
            body="Body",
            audience="user",
            mentor_id="m1",
        )
        assert False, "expected ValueError"
    except ValueError as e:
        assert "mentor_id" in str(e)
