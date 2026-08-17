"""FastAPI entrypoint — run from `backend/` directory: uvicorn main:app --reload --port 8000"""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.v1 import chat_ws
from api.v1.router import api_router
from core.config import settings
from core.limiter import limiter
from db.phase5_bootstrap import ensure_phase5_booking_columns
from db.startup_schema import (
    ensure_chat_billing_columns,
    ensure_chat_session_join_timer_columns,
    ensure_coach_applications_table,
    backfill_booking_linked_chat_sessions,
    ensure_legacy_public_pricing_upgraded,
    ensure_localization_i18n_columns,
    ensure_marketplace_ledger_tables,
    ensure_mentor_availability_windows_table,
    ensure_mentor_unavailability_table,
    ensure_support_inquiries_table,
    ensure_mentor_mollie_fee_tables,
    ensure_mentor_payout_bank_columns,
    ensure_onboarding_installment_columns,
    ensure_promo_code_scope_column,
    ensure_default_onboarding_promo_code,
    ensure_universal_promo_codes,
    ensure_mentors_banner_image_column,
    ensure_mentor_image_crop_columns,
    ensure_mentor_kvk_number_column,
    ensure_mentor_public_card_visibility_column,
    ensure_mentor_presence_tracking,
    ensure_admin_announcements_table,
    ensure_platform_pricing_table,
    ensure_platform_pricing_60_min_column,
)
from services.background_scheduler import start_scheduler, shutdown_scheduler

import logging
import time

from sqlalchemy.exc import DBAPIError

from db.startup_schema import _is_transient_db_error
from db.session import engine

logger = logging.getLogger(__name__)


def _run_startup_step(name: str, fn, *, attempts: int = 3) -> None:
    """Run a schema ensure; retry lost connections; soft-fail lock waits / disconnects so the API can start."""
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            fn()
            return
        except Exception as e:
            last = e
            if not (isinstance(e, DBAPIError) and _is_transient_db_error(e)):
                raise
            code = getattr(getattr(e, "orig", None), "args", (None,))[0]
            # Lock wait won't clear by retrying the same UPDATE while another session holds the row.
            if code == 1205 or attempt >= attempts:
                logger.error(
                    "Startup step %s failed after %s attempt(s); continuing so the API can start: %s",
                    name,
                    attempt,
                    e,
                )
                return
            logger.warning(
                "Startup step %s failed (attempt %s/%s): %s",
                name,
                attempt,
                attempts,
                e,
            )
            try:
                engine.dispose()
            except Exception:
                pass
            time.sleep(0.8 * attempt)
    if last:
        raise last


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CORS allow_origins: %s", settings.cors_origins_list)
    _run_startup_step("ensure_mentors_banner_image_column", ensure_mentors_banner_image_column)
    _run_startup_step("ensure_mentor_image_crop_columns", ensure_mentor_image_crop_columns)
    _run_startup_step("ensure_mentor_kvk_number_column", ensure_mentor_kvk_number_column)
    _run_startup_step(
        "ensure_mentor_public_card_visibility_column",
        ensure_mentor_public_card_visibility_column,
    )
    _run_startup_step("ensure_mentor_presence_tracking", ensure_mentor_presence_tracking)
    _run_startup_step("ensure_admin_announcements_table", ensure_admin_announcements_table)
    _run_startup_step("ensure_localization_i18n_columns", ensure_localization_i18n_columns)
    _run_startup_step("ensure_phase5_booking_columns", ensure_phase5_booking_columns)
    _run_startup_step("ensure_platform_pricing_table", ensure_platform_pricing_table)
    _run_startup_step("ensure_platform_pricing_60_min_column", ensure_platform_pricing_60_min_column)
    _run_startup_step("ensure_legacy_public_pricing_upgraded", ensure_legacy_public_pricing_upgraded)
    _run_startup_step("ensure_mentor_mollie_fee_tables", ensure_mentor_mollie_fee_tables)
    _run_startup_step("ensure_marketplace_ledger_tables", ensure_marketplace_ledger_tables)
    _run_startup_step("ensure_chat_billing_columns", ensure_chat_billing_columns)
    _run_startup_step("ensure_chat_session_join_timer_columns", ensure_chat_session_join_timer_columns)
    _run_startup_step("backfill_booking_linked_chat_sessions", backfill_booking_linked_chat_sessions)
    _run_startup_step("ensure_mentor_payout_bank_columns", ensure_mentor_payout_bank_columns)
    _run_startup_step("ensure_onboarding_installment_columns", ensure_onboarding_installment_columns)
    _run_startup_step("ensure_promo_code_scope_column", ensure_promo_code_scope_column)
    _run_startup_step("ensure_default_onboarding_promo_code", ensure_default_onboarding_promo_code)
    _run_startup_step("ensure_universal_promo_codes", ensure_universal_promo_codes)
    _run_startup_step("ensure_coach_applications_table", ensure_coach_applications_table)
    _run_startup_step("ensure_mentor_availability_windows_table", ensure_mentor_availability_windows_table)
    _run_startup_step("ensure_mentor_unavailability_table", ensure_mentor_unavailability_table)
    _run_startup_step("ensure_support_inquiries_table", ensure_support_inquiries_table)
    start_scheduler()
    yield
    shutdown_scheduler()

app = FastAPI(title="Mentor Booking API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://([a-z0-9-]+\.)*mijnlevenspad\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os

app.include_router(api_router, prefix="/api/v1")
app.include_router(chat_ws.router, prefix="/api/v1")

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
