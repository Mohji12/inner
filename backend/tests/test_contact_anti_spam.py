from __future__ import annotations

import time
from unittest import TestCase

from services.contact_anti_spam import evaluate_public_contact_spam


class ContactAntiSpamTests(TestCase):
    def test_honeypot_silent_block(self) -> None:
        now = time.time()
        result = evaluate_public_contact_spam(
            full_name="Jane Doe",
            subject="Need help booking",
            message="I cannot join my session, please help.",
            website="http://spam.example",
            form_started_at=now - 10,
            now=now,
        )
        self.assertTrue(result.blocked)
        self.assertTrue(result.silent)
        self.assertEqual(result.reason, "honeypot")

    def test_too_fast_block(self) -> None:
        now = time.time()
        result = evaluate_public_contact_spam(
            full_name="Jane Doe",
            subject="Need help booking",
            message="I cannot join my session, please help.",
            website="",
            form_started_at=now - 0.5,
            now=now,
        )
        self.assertTrue(result.blocked)
        self.assertTrue(result.silent)
        self.assertEqual(result.reason, "too_fast")

    def test_gibberish_like_screenshot_block(self) -> None:
        now = time.time()
        result = evaluate_public_contact_spam(
            full_name="ZR61ploJwz",
            subject="ygSowft4zv",
            message="Dsv2JCDKH5IcinePAwzyKgOuLywPy92bNqC8GMFY7wzTxR4UTGqcprM",
            website=None,
            form_started_at=now - 15,
            now=now,
        )
        self.assertTrue(result.blocked)
        self.assertTrue(result.silent)
        self.assertEqual(result.reason, "gibberish")

    def test_latest_spam_sample_block(self) -> None:
        now = time.time()
        result = evaluate_public_contact_spam(
            full_name="zsMSEqMR7F",
            subject="FFjFTtCqaX",
            message="ux6e9HktxdOB72omjvix7gCX5gUjqFXMvRU4tI6ZGH2az8C9oBg50l0",
            website="",
            form_started_at=now - 20,
            now=now,
        )
        self.assertTrue(result.blocked)
        self.assertEqual(result.reason, "gibberish")

    def test_legit_message_passes(self) -> None:
        now = time.time()
        result = evaluate_public_contact_spam(
            full_name="Henriëtte Jansen",
            subject="Question about my booking",
            message="Hello, I paid for a session but the coach did not join. Can you help?",
            website="",
            form_started_at=now - 20,
            now=now,
        )
        self.assertFalse(result.blocked)


if __name__ == "__main__":
    from unittest import main

    main()
