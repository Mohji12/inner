from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


MONEY_Q = Decimal("0.01")


@dataclass(frozen=True)
class CoachCharges:
    platform_fee: Decimal
    tax: Decimal
    total_deduction: Decimal


def _q(v: Decimal) -> Decimal:
    return Decimal(str(v)).quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def compute_coach_platform_fee_and_tax(*, one_minute_rate: Decimal) -> CoachCharges:
    """
    Per agreement:
    - platform fee = 30% of 1-minute rate
    - tax = 21% of full 1-minute rate
    """
    base = Decimal(str(one_minute_rate))
    if base < 0:
        base = Decimal("0")
    platform_fee = _q(base * Decimal("0.30"))
    tax = _q(base * Decimal("0.21"))
    total = _q(platform_fee + tax)
    return CoachCharges(platform_fee=platform_fee, tax=tax, total_deduction=total)

