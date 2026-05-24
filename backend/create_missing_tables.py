"""Check which model tables exist in the DB and create missing ones."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from sqlalchemy import text, inspect
from db.session import Base, engine

# Import ALL models so they register with Base.metadata
from models.admin import Admin
from models.availability_slot import AvailabilitySlot
from models.booking import Booking
from models.chat_bridge_session import ChatBridgeSession
from models.chat_message import ChatMessage
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.email_otp import EmailOtpCode
from models.mentor import Mentor
from models.mentor_monthly_invoice import MentorMonthlyInvoice
from models.mentor_onboarding_payment import MentorOnboardingPayment
from models.mentor_payout_account import MentorPayoutAccount
from models.mentor_settlement import MentorSettlement, MentorSettlementItem
from models.notification import Notification
from models.password_reset import PasswordResetToken
from models.payment import Payment
from models.platform_pricing import PlatformPricing
from models.promo_code import PromoCode
from models.refresh_token import RefreshToken
from models.review import Review
from models.user import User
from models.user_favorite import UserFavorite
from models.waitlist import WaitlistEntry
from models.wallet import Wallet, WalletTransaction

# Get existing tables
inspector = inspect(engine)
existing = set(inspector.get_table_names())

# Get expected tables from models
expected = set(Base.metadata.tables.keys())

missing = expected - existing
present = expected & existing

print(f"\n=== Existing tables ({len(present)}) ===")
for t in sorted(present):
    print(f"  [OK] {t}")

print(f"\n=== Missing tables ({len(missing)}) ===")
for t in sorted(missing):
    print(f"  [MISS] {t}")

if missing:
    print("\nCreating missing tables...")
    tables_to_create = [Base.metadata.tables[t] for t in missing]
    try:
        Base.metadata.create_all(engine, tables=tables_to_create)
        print("Done! All missing tables created.")
    except Exception as e:
        print(f"Error with create_all: {e}")
        print("\nTrying one-by-one with raw SQL fallback...")
        for t in sorted(missing):
            table_obj = Base.metadata.tables[t]
            try:
                Base.metadata.create_all(engine, tables=[table_obj])
                print(f"  [CREATED] {t}")
            except Exception as e2:
                print(f"  [FAIL-FK] {t}: {e2}")
                print(f"    Attempting raw DDL without FK constraints...")
                cols = []
                for col in table_obj.columns:
                    col_type = col.type.compile(dialect=engine.dialect)
                    nullable = "" if col.nullable else " NOT NULL"
                    pk = " PRIMARY KEY" if col.primary_key else ""
                    default = ""
                    if col.default is not None and hasattr(col.default, 'arg'):
                        val = col.default.arg
                        if isinstance(val, str):
                            default = f" DEFAULT '{val}'"
                    cols.append(f"  `{col.name}` {col_type}{nullable}{default}{pk}")
                ddl = f"CREATE TABLE IF NOT EXISTS `{t}` (\n" + ",\n".join(cols) + "\n)"
                try:
                    with engine.connect() as conn:
                        conn.execute(text(ddl))
                        conn.commit()
                    print(f"    [CREATED-NO-FK] {t}")
                except Exception as e3:
                    print(f"    [STILL-FAIL] {t}: {e3}")
else:
    print("\nAll tables exist!")
