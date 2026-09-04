from unittest.mock import MagicMock

from services.chat_service import list_messages


def test_list_messages_without_after_id_uses_newest_first_query():
    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.order_by.return_value = q
    newest_desc = [MagicMock(id="m3"), MagicMock(id="m2"), MagicMock(id="m1")]
    q.limit.return_value.all.return_value = newest_desc

    result = list_messages(db, session_id="s1", after_id=None, limit=3)

    # Service reverses DESC → ASC for UI.
    assert [m.id for m in result] == ["m1", "m2", "m3"]
    assert q.order_by.called
    assert q.limit.call_args.args[0] == 3


def test_list_messages_with_after_id_keeps_forward_sync():
    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.order_by.return_value = q
    q.first.return_value = MagicMock(created_at="pivot")
    q.limit.return_value.all.return_value = [MagicMock(id="m9")]

    result = list_messages(db, session_id="s1", after_id="m8", limit=50)
    assert [m.id for m in result] == ["m9"]
