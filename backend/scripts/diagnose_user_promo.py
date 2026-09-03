"""Diagnose WELCOME5 eligibility for a user by email."""
import sys

from db.session import SessionLocal
from models.booking import Booking
from models.chat_purchase import ChatPurchase
from models.promo_code import PromoCode
from models.promo_code_redemption import PromoCodeRedemption
from models.user import User
from services.welcome_promo_service import welcome_promo_eligibility


def main() -> None:
    email = (sys.argv[1] if len(sys.argv) > 1 else "").strip().lower()
    if not email:
        print("usage: diagnose_user_promo.py <email>")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print("USER_NOT_FOUND")
            return

        print(f"USER_ID={user.id}")
        print(f"EMAIL={user.email}")
        print(f"ELIGIBILITY={welcome_promo_eligibility(db, user.id)}")

        bookings = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at).all()
        print(f"BOOKINGS={len(bookings)}")
        for b in bookings:
            print(
                f"  booking id={b.id} status={b.status} duration={b.duration} "
                f"created={b.created_at.isoformat() if b.created_at else None}"
            )

        from models.chat_session import ChatSession

        chats = db.query(ChatPurchase).filter(ChatPurchase.user_id == user.id).order_by(ChatPurchase.created_at).all()
        print(f"CHAT_PURCHASES={len(chats)}")
        for c in chats:
            sess = db.query(ChatSession).filter(ChatSession.id == c.session_id).first()
            print(
                f"  chat id={c.id} session={c.session_id} status={c.status} "
                f"amount={c.amount} minutes={c.minutes} txn={c.transaction_id} "
                f"session_status={sess.status if sess else None} "
                f"timer_started_at={sess.timer_started_at if sess else None} "
                f"created={c.created_at.isoformat() if c.created_at else None}"
            )

        promo = db.query(PromoCode).filter(PromoCode.code == "WELCOME5").first()
        if promo:
            reds = (
                db.query(PromoCodeRedemption)
                .filter(
                    PromoCodeRedemption.user_id == user.id,
                    PromoCodeRedemption.promo_code_id == promo.id,
                )
                .all()
            )
            print(f"WELCOME5_REDEMPTIONS={len(reds)}")
            for r in reds:
                print(
                    f"  redemption id={r.id} booking_id={r.booking_id} "
                    f"created={r.created_at.isoformat() if r.created_at else None}"
                )
    finally:
        db.close()


if __name__ == "__main__":
    main()
