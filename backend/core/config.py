import os
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

# Always load `backend/.env` (not cwd), so SMTP/DB are correct when uvicorn runs from repo root.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_BACKEND_ENV = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_ENV if _BACKEND_ENV.is_file() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db_host: str = "localhost"
    db_port: str = "3306"
    db_user: str = "admin"
    db_password: str = ""
    db_name: str = "therapy"

    jwt_secret_key: str = "change-me-access-secret"
    jwt_refresh_secret_key: str = "change-me-refresh-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "https://mijnlevenspad.com,https://www.mijnlevenspad.com,"
        "https://staging.dutgt85z7f3h6.amplifyapp.com"
    )

    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    user_refresh_cookie: str = "ipd_refresh_user"
    mentor_refresh_cookie: str = "ipd_refresh_mentor"
    admin_refresh_cookie: str = "ipd_refresh_admin"

    app_name: str = "Mijn Levenspad"

    # SMTP (ZeptoMail / etc.) — set in .env; leave host empty to log OTP only (dev)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Mijn Levenspad"
    smtp_use_tls: bool = True

    otp_expire_minutes: int = 15
    otp_max_attempts: int = 5
    otp_pepper: str = ""

    # When true, public /mentors lists (and detail/slots) include status=pending mentors (local testing only).
    public_mentor_list_include_pending: bool = False

    # LiveKit Cloud (or self-hosted) — voice/video calls bound to chat sessions. Leave empty to disable token minting.
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    # Outbound SIP (PSTN): trunk id from LiveKit dashboard after linking Twilio/Telnyx SIP. Empty disables phone dial-out.
    livekit_sip_outbound_trunk_id: str = ""
    # E.164 caller ID for outbound dials (e.g. your Twilio number). Often required if the trunk allows multiple numbers or "*".
    livekit_sip_caller_id: str = ""

    # Phase 3: Social & 2FA
    google_client_id: str = ""
    google_client_secret: str = ""
    two_factor_issuer: str = "Inner Path"

    # Payments (Mollie)
    mollie_api_key: str = ""
    mollie_client_id: str = ""
    mollie_client_secret: str = ""
    mollie_connect_redirect_uri: str = ""
    mollie_connect_auth_url: str = "https://my.mollie.com/dashboard/oauth2/authorize"
    mollie_connect_token_url: str = "https://api.mollie.com/oauth2/tokens"
    mollie_webhook_secret: str = ""
    # Public HTTPS base of the *API* host for webhooks (no path). If empty, localhost URLs are omitted so Mollie accepts payments in dev (no server-side payment webhooks).
    mollie_webhook_base_url: str = ""
    mollie_redirect_base_url: str = "http://localhost:5173"
    mollie_api_base: str = "https://api.mollie.com/v2"
    payment_currency: str = "EUR"
    #: Comma-separated ISO 4217 codes allowed at Mollie checkout (converted from EUR base). EUR should be included.
    payment_checkout_currencies: str = "EUR"
    #: Frankfurter (ECB) pattern: GET params from=EUR — full URL optional.
    fx_rates_url: str = "https://api.frankfurter.app/latest"
    fx_rates_cache_ttl_seconds: int = 900
    fx_rates_http_timeout_seconds: float = 10.0
    # Public session tiers: €/min × 5 | 10 | 20 | 30 (stored in platform_pricing; bootstrap fills defaults).
    session_price_eur_per_minute: Decimal = Decimal("0.90")
    #: One-time coach onboarding checkout amount in EUR (0 = free registration).
    mentor_onboarding_fee_eur: Decimal = Decimal("0")
    #: Optional percent added on top of fee at checkout (0 = fee is all-in, tax included).
    mentor_onboarding_fee_add_percent: Decimal = Decimal("0")
    #: Number of installments when coach chooses split payment (2 × half of total).
    mentor_onboarding_installment_count: int = 2
    #: Default 100% onboarding promo created on startup when missing (empty = skip seed).
    mentor_onboarding_promo_seed_code: str = "COACHFREE"
    mentor_monthly_fee_percent: Decimal = Decimal("27")
    #: Platform fee % on metered chat gross (coach receives the remainder, default 70%).
    marketplace_default_commission_percent: Decimal = Decimal("30")
    #: Coach share % on metered chat gross (includes coach tax obligations; remainder after platform fee).
    marketplace_default_coach_share_percent: Decimal = Decimal("70")
    #: Optional separate tax % on metered gross (0 = tax handled within coach share).
    chat_session_tax_percent: Decimal = Decimal("0")
    #: One-time EUR fee per chat session (from user hold / added to first Mollie chat checkout), not shared with coach.
    chat_session_transaction_fee_eur: Decimal = Decimal("0.50")
    marketplace_min_withdrawal_amount: Decimal = Decimal("10.00")
    marketplace_payout_cooldown_hours: int = 24
    marketplace_hold_expiry_minutes: int = 120
    marketplace_billing_tick_seconds: int = 10

    # Cloudinary (profile / banner uploads). Leave any value empty to fall back to local `uploads/`.
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    # Meta Conversions API (server-side events)
    meta_pixel_id: str = ""
    meta_capi_access_token: str = ""
    # Optional for Meta Events Manager Test Events view.
    meta_test_event_code: str = ""
    redis_url: str = "redis://localhost:6379/0"
    #: If set, Celery stores task results in this backend. If empty, results are disabled — the API process will not open a result-backend connection on `.delay()` (avoids Redis reconnect loops when you only enqueue from the web app).
    celery_result_backend_url: str = ""

    @property
    def database_url(self) -> str:
        pwd = quote_plus(self.db_password)
        return f"mysql+pymysql://{self.db_user}:{pwd}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def cors_origins_list(self) -> list[str]:
        """Merge env-configured origins with required production SPA hosts."""
        seen: set[str] = set()
        merged: list[str] = []
        required = (
            "https://mijnlevenspad.com",
            "https://www.mijnlevenspad.com",
        )
        for origin in (*required, *(o.strip() for o in self.cors_origins.split(",") if o.strip())):
            if origin not in seen:
                seen.add(origin)
                merged.append(origin)
        return merged

    @property
    def cloudinary_configured(self) -> bool:
        return bool(
            self.cloudinary_cloud_name.strip()
            and self.cloudinary_api_key.strip()
            and self.cloudinary_api_secret.strip()
        )

    @property
    def mentor_onboarding_charge_eur(self) -> Decimal:
        base = Decimal(str(self.mentor_onboarding_fee_eur))
        pct = Decimal(str(self.mentor_onboarding_fee_add_percent)) / Decimal("100")
        return (base * (Decimal("1") + pct)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @property
    def mentor_onboarding_installment_charge_eur(self) -> Decimal:
        total = self.mentor_onboarding_charge_eur
        parts = max(1, int(self.mentor_onboarding_installment_count))
        return (total / Decimal(parts)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# Reload Settings when backend/.env changes (mtime). Avoids stale values when uvicorn --reload
# does not restart on .env-only edits.
_settings_cache: Settings | None = None
_env_mtime: float | None = None


def get_settings() -> Settings:
    global _settings_cache, _env_mtime
    try:
        mtime = os.path.getmtime(_BACKEND_ENV) if _BACKEND_ENV.is_file() else -1.0
    except OSError:
        mtime = -1.0
    if _settings_cache is None or _env_mtime != mtime:
        _env_mtime = mtime
        _settings_cache = Settings()
    return _settings_cache


class _SettingsProxy:
    __slots__ = ()

    def __getattr__(self, name: str):
        return getattr(get_settings(), name)


settings = _SettingsProxy()
