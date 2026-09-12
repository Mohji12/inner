from unittest import TestCase
from unittest.mock import MagicMock

from services.chat_service import ChatError, extend_session_with_wallet


class ExtendSessionWithWalletTests(TestCase):
    def test_rejects_invalid_minutes(self) -> None:
        db = MagicMock()
        with self.assertRaises(ChatError) as ctx:
            extend_session_with_wallet(db, session_id="s1", user_id="u1", minutes=0)
        self.assertEqual(ctx.exception.code, "invalid_minutes")

    def test_rejects_missing_session(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = None
        with self.assertRaises(ChatError) as ctx:
            extend_session_with_wallet(db, session_id="missing", user_id="u1", minutes=10)
        self.assertEqual(ctx.exception.code, "session_not_found")


if __name__ == "__main__":
    from unittest import main

    main()
