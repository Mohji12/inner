"""Production smoke: manual_occupied blocks public chat_available.

Run on EC2:
  cd /home/ubuntu/inner/backend && PYTHONPATH=. ./venv/bin/python3 scripts/test_occupied_toggle_prod.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

import requests

sys.path.insert(0, ".")

from database import SessionLocal
from models.mentor import Mentor
from services.presence_service import presence_service

BASE = "https://life.mijnlevenspad.com/api/v1"


def public_mentor(mid: str) -> dict | None:
    r = requests.get(f"{BASE}/mentors", timeout=30)
    r.raise_for_status()
    items = r.json() if isinstance(r.json(), list) else r.json().get("items") or []
    for m in items:
        if m.get("id") == mid:
            return m
    return None


def pick_online_mentor(db) -> Mentor | None:
    mentors = (
        db.query(Mentor)
        .filter(Mentor.status == "active", Mentor.is_approved.is_(True))
        .order_by(Mentor.last_seen_at.desc())
        .limit(20)
        .all()
    )
    for m in mentors:
        if presence_service.is_online(m.id, "mentor", last_seen_at=m.last_seen_at):
            pub = public_mentor(m.id)
            if pub and pub.get("chat_available"):
                return m
    return None


def main() -> int:
    db = SessionLocal()
    mentor = None
    try:
        mentor = pick_online_mentor(db)
        if not mentor:
            print("SKIP no online coach with chat_available=true on public list")
            return 0

        mid = mentor.id
        before = public_mentor(mid)
        print(f"coach={mentor.full_name!r} id={mid}")
        print(f"before chat_available={before.get('chat_available') if before else None}")

        mentor.manual_occupied = True
        mentor.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(mentor)

        during = public_mentor(mid)
        during_avail = during.get("chat_available") if during else None
        print(f"during chat_available={during_avail}")
        if during_avail:
            print("FAIL occupied coach still chat_available on public list")
            return 1

        mentor.manual_occupied = False
        mentor.updated_at = datetime.now(timezone.utc)
        db.commit()

        after = public_mentor(mid)
        after_avail = after.get("chat_available") if after else None
        print(f"after chat_available={after_avail}")
        if not after_avail:
            print("WARN coach not chat_available after clearing occupied (may be stale heartbeat)")
        else:
            print("PASS occupied toggle blocks public availability")
        return 0
    finally:
        if mentor is not None:
            try:
                mentor.manual_occupied = False
                mentor.updated_at = datetime.now(timezone.utc)
                db.commit()
            except Exception:
                db.rollback()
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
