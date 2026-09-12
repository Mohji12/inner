from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from services.pending_user_registration_service import (
    PENDING_REGISTRATION_HOURS,
    create_user_from_pending,
    upsert_pending_user_registration,
)


class PendingUserRegistrationServiceTests(TestCase):
    def test_upsert_rejects_existing_user_email(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(id="u1")
        with self.assertRaises(ValueError) as ctx:
            upsert_pending_user_registration(
                db,
                full_name="Ada",
                email="ada@example.com",
                phone_number="+31612345678",
                password="TestPassword123!",
                preferred_language="en",
                timezone_name="UTC",
            )
        self.assertEqual(str(ctx.exception), "email_taken")

    def test_create_user_from_pending_sets_verified(self) -> None:
        now = datetime.now(timezone.utc)
        pending = SimpleNamespace(
            id="pending-1",
            full_name="Ada Lovelace",
            email="ada@example.com",
            phone_number="+31612345678",
            password_hash="hashed",
            timezone="Europe/Amsterdam",
            preferred_language="nl",
            expires_at=now + timedelta(hours=PENDING_REGISTRATION_HOURS),
        )
        db = MagicMock()
        # first() for email check, then phone check → neither exists
        db.query.return_value.filter.return_value.first.side_effect = [None, None]

        with patch("services.pending_user_registration_service.User") as UserCls:
            user_obj = SimpleNamespace(id="pending-1", email_verified=True)
            UserCls.return_value = user_obj
            user = create_user_from_pending(db, pending)

        self.assertIs(user, user_obj)
        UserCls.assert_called_once()
        kwargs = UserCls.call_args.kwargs
        self.assertTrue(kwargs["email_verified"])
        self.assertEqual(kwargs["id"], "pending-1")
        self.assertEqual(kwargs["account_status"], "active")
        db.add.assert_called_once_with(user_obj)
        db.delete.assert_called_once_with(pending)

    def test_create_user_from_pending_rejects_expired(self) -> None:
        now = datetime.now(timezone.utc)
        pending = SimpleNamespace(
            id="pending-1",
            email="ada@example.com",
            phone_number="+31612345678",
            expires_at=now - timedelta(minutes=1),
        )
        db = MagicMock()
        with self.assertRaises(ValueError) as ctx:
            create_user_from_pending(db, pending)
        self.assertEqual(str(ctx.exception), "pending_expired")
        db.delete.assert_called_once_with(pending)


if __name__ == "__main__":
    from unittest import main

    main()
