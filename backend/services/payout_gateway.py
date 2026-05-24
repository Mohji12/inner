"""Mollie Connect payout gateway adapter."""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from services.mollie_service import MollieServiceError, create_connected_account_payout, get_connected_account_payout


@dataclass
class PayoutResult:
    provider_ref: str
    status: str
    processed_at: datetime


class PayoutGatewayAdapter:
    provider_name = "mollie_connect"

    @staticmethod
    def _parse_dt(raw: str | None) -> datetime:
        if not raw:
            return datetime.now(timezone.utc)
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)

    @staticmethod
    def _normalize_status(raw_status: str | None) -> str:
        status = (raw_status or "").strip().lower()
        if status in {"paid", "queued", "pending", "open"}:
            return "paid" if status == "paid" else "processing"
        if status in {"failed", "canceled", "expired"}:
            return "failed"
        return "processing"

    def create_payout(
        self,
        *,
        mentor_account_ref: str,
        amount: str,
        currency: str,
        reference: str,
        access_token: str,
    ) -> PayoutResult:
        _ = mentor_account_ref
        try:
            payout = create_connected_account_payout(
                access_token=access_token,
                amount=Decimal(str(amount)),
                currency=currency,
                reference=reference,
            )
        except MollieServiceError as exc:
            raise RuntimeError(str(exc)) from exc

        payout_id = str(payout.get("id") or "")
        payout_status = self._normalize_status(str(payout.get("status") or ""))
        processed_at = self._parse_dt(payout.get("createdAt") or payout.get("settledAt"))
        if not payout_id:
            raise RuntimeError("Mollie payout response missing id")
        return PayoutResult(
            provider_ref=payout_id,
            status=payout_status,
            processed_at=processed_at,
        )

    def get_payout_status(self, provider_ref: str, *, access_token: str) -> str:
        try:
            data = get_connected_account_payout(access_token=access_token, payout_id=provider_ref)
        except MollieServiceError:
            return "processing"
        return self._normalize_status(str(data.get("status") or ""))


payout_gateway = PayoutGatewayAdapter()
