from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from services.pending_user_registration_service import (
    PENDING_REGISTRATION_HOURS,
    create_user_from_pending,
    get_pending_by_verify_token,
    hash_verify_token,
    issue_verify_link_token,
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

    def test_issue_verify_link_token_sets_hash_and_expiry(self) -> None:
        pending = SimpleNamespace(
            verify_token_hash=None,
            verify_token_expires_at=None,
            updated_at=None,
        )
        with patch(
            "services.pending_user_registration_service.settings"
        ) as settings:
            settings.otp_expire_minutes = 15
            token = issue_verify_link_token(pending)
        self.assertTrue(len(token) >= 32)
        self.assertEqual(pending.verify_token_hash, hash_verify_token(token))
        self.assertIsNotNone(pending.verify_token_expires_at)

    def test_get_pending_by_verify_token_rejects_expired_token(self) -> None:
        now = datetime.now(timezone.utc)
        token = "a" * 40
        pending = SimpleNamespace(
            verify_token_hash=hash_verify_token(token),
            verify_token_expires_at=now - timedelta(minutes=1),
            expires_at=now + timedelta(hours=1),
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = pending
        self.assertIsNone(get_pending_by_verify_token(db, token))

    def test_get_pending_by_verify_token_accepts_valid_token(self) -> None:
        now = datetime.now(timezone.utc)
        token = "b" * 40
        pending = SimpleNamespace(
            verify_token_hash=hash_verify_token(token),
            verify_token_expires_at=now + timedelta(minutes=10),
            expires_at=now + timedelta(hours=1),
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = pending
        self.assertIs(get_pending_by_verify_token(db, token), pending)


if __name__ == "__main__":
    from unittest import main

    main()
