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
    ensure_mentor_mollie_fee_tables,
    ensure_mentor_payout_bank_columns,
    ensure_onboarding_installment_columns,
    ensure_mentors_banner_image_column,
    ensure_platform_pricing_table,
)
from services.background_scheduler import start_scheduler, shutdown_scheduler

import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CORS allow_origins: %s", settings.cors_origins_list)
    ensure_mentors_banner_image_column()
    ensure_localization_i18n_columns()
    ensure_phase5_booking_columns()
    ensure_platform_pricing_table()
    ensure_legacy_public_pricing_upgraded()
    ensure_mentor_mollie_fee_tables()
    ensure_marketplace_ledger_tables()
    ensure_chat_billing_columns()
    ensure_chat_session_join_timer_columns()
    backfill_booking_linked_chat_sessions()
    ensure_mentor_payout_bank_columns()
    ensure_onboarding_installment_columns()
    ensure_coach_applications_table()
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
