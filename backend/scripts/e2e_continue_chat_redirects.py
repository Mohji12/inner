"""E2E-ish checks for continue-chat / extend / booking fail payment status (no deploy).

Uses the local DB via app services (no Mollie live charge).

  cd backend
  .\\.venv\\Scripts\\python.exe scripts\\e2e_continue_chat_redirects.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.chat_states import CHAT_PURCHASE_PENDING, CHAT_SESSION_ACTIVE, CHAT_SESSION_ENDED
from core.security import new_uuid
from db.session import SessionLocal
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.user import User
from services.chat_service import quote_session_extension
from services.mollie_service import _apply_chat_purchase_paid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def main() -> int:
    db = SessionLocal()
    errors: list[str] = []
    try:
        user = db.query(User).order_by(User.created_at.desc()).first()
        mentor = (
            db.query(Mentor)
            .filter(Mentor.status == "approved")
            .order_by(Mentor.created_at.desc())
            .first()
        )
        if not mentor:
            mentor = db.query(Mentor).order_by(Mentor.created_at.desc()).first()
        if not user or not mentor:
            print("FAIL: need at least one user and one active mentor in DB")
            return 1

        print(f"Using user={user.email} mentor={mentor.email}")

        # --- Continue after ended ---
        session = ChatSession(
            id=new_uuid(),
            user_id=user.id,
            mentor_id=mentor.id,
            status=CHAT_SESSION_ENDED,
            ends_at=_utcnow() - timedelta(hours=2),
            allocated_duration_minutes=10,
            user_joined_at=_utcnow() - timedelta(hours=3),
            mentor_joined_at=_utcnow() - timedelta(hours=3),
            timer_started_at=_utcnow() - timedelta(hours=3),
            created_at=_utcnow() - timedelta(hours=3),
            updated_at=_utcnow() - timedelta(hours=2),
            last_message_at=_utcnow() - timedelta(hours=2),
            unread_count_user=0,
            unread_count_mentor=0,
        )
        db.add(session)
        db.commit()

        try:
            quote = quote_session_extension(
                db,
                session_id=session.id,
                user_id=user.id,
                minutes=max(1, int(mentor.chat_min_purchase_minutes or 1)),
                checkout_currency="EUR",
            )
            print("OK quote on ended session", quote["total_eur"])
        except Exception as e:
            errors.append(f"quote on ended failed: {e}")
            print("FAIL quote on ended:", e)

        purchase = ChatPurchase(
            id=new_uuid(),
            session_id=session.id,
            user_id=user.id,
            minutes=max(1, int(getattr(mentor, "chat_min_purchase_minutes", None) or 1)),
            amount=Decimal("5.00"),
            amount_base_eur=Decimal("5.00"),
            currency="EUR",
            status=CHAT_PURCHASE_PENDING,
            transaction_id=f"tr_test_{new_uuid()[:8]}",
            created_at=_utcnow(),
        )
        db.add(purchase)
        db.commit()

        _apply_chat_purchase_paid(db, purchase)
        db.commit()
        db.refresh(session)
        if session.status != CHAT_SESSION_ACTIVE:
            errors.append(f"expected active after paid continue, got {session.status}")
            print("FAIL status", session.status)
        else:
            ends = session.ends_at
            if ends.tzinfo is None:
                ends = ends.replace(tzinfo=timezone.utc)
            if ends <= _utcnow():
                errors.append("ends_at not in future after continue")
                print("FAIL ends_at", session.ends_at)
            else:
                print("OK continue paid -> active, ends_at", session.ends_at.isoformat())

        # Cleanup test rows
        db.query(ChatPurchase).filter(ChatPurchase.session_id == session.id).delete()
        db.query(ChatSession).filter(ChatSession.id == session.id).delete()
        db.commit()

        # --- Import redirect helpers ---
        from services.mollie_service import resolve_frontend_return_origin

        origin = resolve_frontend_return_origin(
            None, claimed_origin="https://www.mijnlevenspad.com"
        )
        if "mijnlevenspad.com" not in origin:
            errors.append(f"unexpected origin resolve: {origin}")
            print("FAIL origin", origin)
        else:
            print("OK resolve_frontend_return_origin", origin)

    finally:
        db.close()

    if errors:
        print("\nFAILED:")
        for e in errors:
            print(" -", e)
        return 1
    print("\nAll continue-chat service checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
