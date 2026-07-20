"""Shared booking access checks for user, mentor, and admin actors."""

from __future__ import annotations

from api.deps import AnyActor
from models.booking import Booking


def actor_can_access_booking(booking: Booking, actor: AnyActor) -> bool:
    if actor.role == "user":
        return booking.user_id == actor.subject_id
    if actor.role == "mentor":
        return booking.mentor_id == actor.subject_id
    if actor.role == "admin":
        return True
    return False
