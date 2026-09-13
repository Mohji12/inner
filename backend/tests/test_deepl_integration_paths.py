"""Light tests that coach / announcement paths call DeepL helpers when translation is missing."""
from unittest.mock import MagicMock, patch

from api.v1 import mentors_public as mp
from services.admin_announcement_service import broadcast_admin_announcement


def test_ensure_mentor_field_i18n_calls_helper_and_sets_attr():
    mentor = MagicMock()
    mentor.id = "m1"
    mentor.headline_i18n = {"en": "Hello"}
    mentor.headline = "Hello"

    with patch(
        "api.v1.mentors_public.ensure_lang_in_i18n_map",
        return_value={"en": "Hello", "fr": "Bonjour"},
    ) as ensure:
        dirty = mp._ensure_mentor_field_i18n(
            mentor,
            attr_i18n="headline_i18n",
            fallback_text=mentor.headline,
            lang="fr",
        )

    assert dirty is True
    assert mentor.headline_i18n == {"en": "Hello", "fr": "Bonjour"}
    ensure.assert_called_once()


def test_ensure_mentor_field_i18n_soft_fails():
    mentor = MagicMock()
    mentor.id = "m1"
    mentor.headline_i18n = None
    mentor.headline = "Hello"

    with patch(
        "api.v1.mentors_public.ensure_lang_in_i18n_map",
        side_effect=RuntimeError("boom"),
    ):
        dirty = mp._ensure_mentor_field_i18n(
            mentor,
            attr_i18n="headline_i18n",
            fallback_text=mentor.headline,
            lang="fr",
        )
    assert dirty is False


def test_broadcast_builds_i18n_maps_via_deepl():
    db = MagicMock()
    user = MagicMock()
    user.id = "u1"
    user.email = "user@example.com"
    user.full_name = "Ada"
    user_q = MagicMock()
    user_q.filter.return_value.first.return_value = user
    db.query.return_value = user_q

    title_map = {"en": "Hello", "nl": "Hallo"}
    body_map = {"en": "Body", "nl": "Inhoud"}

    with (
        patch(
            "services.admin_announcement_service.ensure_i18n_map",
            side_effect=[title_map, body_map],
        ) as ensure,
        patch("services.admin_announcement_service.create_notification") as create_notif,
        patch(
            "services.admin_announcement_service.send_plain_emails",
            return_value=(1, None),
        ),
        patch("services.admin_announcement_service.new_uuid", return_value="ann-1"),
    ):
        broadcast_admin_announcement(
            db,
            admin_id="admin-1",
            title="Hello",
            body="Body",
            send_email=True,
            audience="user",
            user_id="u1",
            source_lang="en",
        )

    assert ensure.call_count == 2
    kwargs = dict(create_notif.call_args.kwargs)
    assert kwargs["title_i18n"] == title_map
    assert kwargs["body_i18n"] == body_map
