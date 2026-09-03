from __future__ import annotations

from datetime import date
from pathlib import Path
import sys

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from api.v1.users_me import user_spending_series  # noqa: E402
from api.v1.mentor_me import mentor_earnings_series  # noqa: E402


class _FakeQuery:
    def __init__(self, all_results_queue: list[list[tuple[object, object]]]):
        self._q = all_results_queue

    def join(self, *_args, **_kwargs):
        return self

    def filter(self, *_args, **_kwargs):
        return self

    def group_by(self, *_args, **_kwargs):
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        return self._q.pop(0) if self._q else []


class _FakeDb:
    def __init__(self, all_results_queue: list[list[tuple[object, object]]]):
        self._q = all_results_queue

    def query(self, *_args, **_kwargs):
        return _FakeQuery(self._q)


class _Obj:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_user_spending_series_invalid_period_400():
    with pytest.raises(HTTPException) as exc:
        user_spending_series(db=_FakeDb([]), user=_Obj(id="u1"), period="nope")
    assert exc.value.status_code == 400


def test_user_spending_series_shapes_amounts_as_strings():
    db = _FakeDb(
        all_results_queue=[
            [(date(2026, 1, 1), 10)],  # bookings_by_day
            [(date(2026, 1, 2), 3.5)],  # chat_by_day
        ]
    )
    out = user_spending_series(db=db, user=_Obj(id="u1"), period="month")
    assert out.period == "month"
    assert out.bookings_by_day[0].date == "2026-01-01"
    assert out.bookings_by_day[0].amount == "10"
    assert out.chat_by_day[0].date == "2026-01-02"
    assert out.chat_by_day[0].amount == "3.5"


def test_mentor_earnings_series_invalid_period_400():
    with pytest.raises(HTTPException) as exc:
        mentor_earnings_series(db=_FakeDb([]), me=_Obj(id="m1"), period="nope")
    assert exc.value.status_code == 400


def test_mentor_earnings_series_shapes_amounts_as_strings():
    db = _FakeDb(
        all_results_queue=[
            [(date(2026, 2, 1), 12)],  # bookings_by_day
            [(date(2026, 2, 2), 4)],  # chat_by_day
        ]
    )
    out = mentor_earnings_series(db=db, me=_Obj(id="m1"), period="month")
    assert out.period == "month"
    assert out.bookings_by_day[0].date == "2026-02-01"
    assert out.bookings_by_day[0].amount == "12"
    assert out.chat_by_day[0].date == "2026-02-02"
    assert out.chat_by_day[0].amount == "4"

