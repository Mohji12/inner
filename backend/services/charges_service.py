from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


MONEY_Q = Decimal("0.01")
COACH_SHARE_PERCENT = Decimal("70")
PLATFORM_FEE_PERCENT = Decimal("30")


@dataclass(frozen=True)
class CoachCharges:
    platform_fee: Decimal
    tax: Decimal
    total_deduction: Decimal
    coach_net: Decimal


def _q(v: Decimal) -> Decimal:
    return Decimal(str(v)).quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def compute_coach_platform_fee_and_tax(*, one_minute_rate: Decimal) -> CoachCharges:
    """
    Per agreement:
    - platform fee = 30% of 1-minute rate
    - coach receives 70% (includes coach's own tax obligations)
    """
    base = Decimal(str(one_minute_rate))
    if base < 0:
        base = Decimal("0")
    platform_fee = _q(base * PLATFORM_FEE_PERCENT / Decimal("100"))
    coach_net = _q(base * COACH_SHARE_PERCENT / Decimal("100"))
    return CoachCharges(
        platform_fee=platform_fee,
        tax=Decimal("0.00"),
        total_deduction=platform_fee,
        coach_net=coach_net,
    )
