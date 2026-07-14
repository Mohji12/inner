from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from sqlalchemy import or_, String, cast

from api.deps import DbSession, RequestLang
from core.config import settings
from models.availability_slot import AvailabilitySlot
from models.booking import Booking
from models.mentor import Mentor
from schemas.mentor import MentorDetailOut, MentorPublicOut, PlatformPricingPublicOut
from schemas.slot import SlotOut
from services.mentor_card_visibility import apply_card_visibility_to_public, normalize_card_visibility
from services.chat_service import mentor_ids_with_live_chat, mentor_chat_busy
from services.i18n_service import resolve_i18n_text
from services.presence_service import presence_service
from services.pricing_service import effective_chat_price_per_minute_eur, get_platform_pricing


router = APIRouter(prefix="/mentors", tags=["mentors-public"])


class ChatAvailabilityOut(BaseModel):
    available: bool
    reason: str | None = None


def _public_identity_key(row: MentorPublicOut) -> tuple[str, str, str]:
    """Group records that look identical to end users on listing cards."""
    return (
        (row.full_name or "").strip().lower(),
        (row.headline or "").strip().lower(),
        (row.profile_image or "").strip().lower(),
    )


def _dedupe_public_rows(rows: list[MentorPublicOut]) -> list[MentorPublicOut]:
    """
    De-duplicate visually identical public cards.
    Prefer currently-online entry, then most recently seen/created.
    """
    chosen: dict[tuple[str, str, str], MentorPublicOut] = {}

    def score(row: MentorPublicOut) -> tuple[int, datetime, datetime]:
        last_seen = row.last_seen_at or datetime.min
        created = row.created_at or datetime.min
        return (1 if row.is_online else 0, last_seen, created)

    for row in rows:
        key = _public_identity_key(row)
        current = chosen.get(key)
        if current is None or score(row) > score(current):
            chosen[key] = row
    return list(chosen.values())


def _mentor_public_out(
    mentor: Mentor,
    busy_mentor_ids: set[str],
    *,
    session_pricing_active: bool,
    lang: str,
) -> MentorPublicOut:
    base = MentorPublicOut.model_validate(mentor)
    is_online = presence_service.is_online(mentor.id, "mentor")
    chat_rate = effective_chat_price_per_minute_eur(mentor)
    available = is_online and chat_rate > 0 and mentor.id not in busy_mentor_ids

    packages_ok = session_pricing_active and mentor.is_approved and mentor.status == "active"

    # Calculate badges
    badges = []
    if mentor.is_verified:
        badges.append("Verified")
    if mentor.average_rating and mentor.average_rating >= 4.5 and mentor.total_reviews >= 5:
        badges.append("Top Rated")
    if mentor.total_sessions_completed >= 50:
        badges.append("Expert")

    out = base.model_copy(update={
        "headline": resolve_i18n_text(getattr(mentor, "headline_i18n", None), mentor.headline, lang),
        "chat_price_per_minute": chat_rate,
        "chat_available": available,
        "is_online": is_online,
        "last_seen_at": mentor.last_seen_at,
        "badges": badges,
        "session_packages_available": packages_ok,
    })
    visibility = normalize_card_visibility(getattr(mentor, "public_card_visibility", None))
    return apply_card_visibility_to_public(out, visibility)


def _listed_status_filter():
    if settings.public_mentor_list_include_pending:
        return Mentor.status.in_(["active", "pending"])
    return Mentor.status == "active"


def _mentor_visible_for_public(mentor: Mentor | None) -> bool:
    if mentor is None:
        return False
    if mentor.status == "active":
        return True
    if settings.public_mentor_list_include_pending and mentor.status == "pending":
        return True
    return False


@router.get("", response_model=list[MentorPublicOut])
def list_mentors(
    db: DbSession,
    lang: RequestLang,
    approved_only: bool = Query(default=True),
    q: str | None = Query(default=None),
    expertise: list[str] | None = Query(default=None),
    languages: list[str] | None = Query(default=None),
    min_price: float | None = Query(default=None),
    max_price: float | None = Query(default=None),
    min_rating: float | None = Query(default=None),
    sort_by: str | None = Query(default="relevance"),
) -> list[MentorPublicOut]:
    pricing = get_platform_pricing(db)
    if min_price is not None and float(pricing.price_10_min) < min_price:
        return []
    if max_price is not None and float(pricing.price_10_min) > max_price:
        return []
    query = db.query(Mentor).filter(_listed_status_filter())
    if approved_only:
        query = query.filter(Mentor.is_approved.is_(True))
        
    if q:
        query = query.filter(
            or_(
                Mentor.full_name.ilike(f"%{q}%"),
                Mentor.headline.ilike(f"%{q}%"),
                Mentor.bio.ilike(f"%{q}%")
            )
        )
        
    if expertise:
        for exp in expertise:
            query = query.filter(cast(Mentor.expertise_areas, String).ilike(f'%"{exp}"%'))
            
    if languages:
        for lang in languages:
            query = query.filter(cast(Mentor.languages_spoken, String).ilike(f'%"{lang}"%'))
            
    if min_rating is not None:
        query = query.filter(Mentor.average_rating >= min_rating)
        
    if sort_by == "rating_desc":
        query = query.order_by(Mentor.average_rating.desc())
    else:
        # Default relevance (for now just created_at desc)
        query = query.order_by(Mentor.created_at.desc())
        
    busy = mentor_ids_with_live_chat(db)
    rows = query.all()
    active_pricing = bool(pricing.is_active)
    public_rows = [_mentor_public_out(m, busy, session_pricing_active=active_pricing, lang=lang) for m in rows]
    return _dedupe_public_rows(public_rows)


@router.get("/pricing", response_model=PlatformPricingPublicOut)
def get_pricing(db: DbSession) -> PlatformPricingPublicOut:
    pricing = get_platform_pricing(db)
    return PlatformPricingPublicOut(
        price_5_min=pricing.price_5_min,
        price_10_min=pricing.price_10_min,
        price_20_min=pricing.price_20_min,
        price_30_min=pricing.price_30_min,
        price_60_min=getattr(pricing, "price_60_min", None) or Decimal("0"),
        currency=pricing.currency,
        is_active=pricing.is_active,
    )


@router.get("/{mentor_id}", response_model=MentorDetailOut)
def get_mentor(mentor_id: str, db: DbSession, lang: RequestLang) -> MentorDetailOut:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor or not _mentor_visible_for_public(mentor):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")
    busy = mentor_ids_with_live_chat(db)
    pricing = get_platform_pricing(db)
    out = _mentor_public_out(mentor, busy, session_pricing_active=bool(pricing.is_active), lang=lang)

    base_detail = MentorDetailOut.model_validate(mentor)
    detail = {**base_detail.model_dump(), **out.model_dump()}
    detail["bio"] = resolve_i18n_text(getattr(mentor, "bio_i18n", None), mentor.bio, lang)
    detail["chat_price_per_minute"] = effective_chat_price_per_minute_eur(mentor)
    # Never expose company / KVK on the public coach profile.
    detail["current_company"] = None
    detail["kvk_number"] = None
    return MentorDetailOut.model_validate(detail)


@router.get("/{mentor_id}/chat-availability", response_model=ChatAvailabilityOut)
def mentor_chat_availability(mentor_id: str, db: DbSession) -> ChatAvailabilityOut:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor or not _mentor_visible_for_public(mentor):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")
    enabled = effective_chat_price_per_minute_eur(mentor) > 0
    busy = mentor_chat_busy(db, mentor_id)
    online = presence_service.is_online(mentor.id, "mentor")
    available = enabled and online and not busy
    reason: str | None = None
    if not enabled:
        reason = "chat_disabled"
    elif not online:
        reason = "mentor_offline"
    elif busy:
        reason = "mentor_busy"
    return ChatAvailabilityOut(available=available, reason=reason)


@router.get("/{mentor_id}/slots", response_model=list[SlotOut])
def list_mentor_slots(
    mentor_id: str,
    db: DbSession,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
) -> list[AvailabilitySlot]:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor or not _mentor_visible_for_public(mentor):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")
    # Profile can be visible (e.g. pending in dev) before booking is allowed — return [] instead of 404.
    if not mentor.is_approved or mentor.status != "active":
        return []
    q = db.query(AvailabilitySlot).filter(
        AvailabilitySlot.mentor_id == mentor_id,
        AvailabilitySlot.is_booked.is_(False),
        ~db.query(Booking.id).filter(Booking.slot_id == AvailabilitySlot.id).exists(),
    )
    if date_from:
        q = q.filter(AvailabilitySlot.start_at_utc >= datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc))
    if date_to:
        q = q.filter(AvailabilitySlot.start_at_utc <= datetime.combine(date_to, time.max).replace(tzinfo=timezone.utc))
    rows = q.order_by(AvailabilitySlot.start_at_utc).all()
    for row in rows:
        # Defensive fallback for legacy rows created before UTC columns existed.
        if row.start_at_utc is None:
            row.start_at_utc = datetime.combine(row.slot_date, row.start_time).replace(tzinfo=timezone.utc)
        if row.end_at_utc is None:
            row.end_at_utc = datetime.combine(row.slot_date, row.end_time).replace(tzinfo=timezone.utc)
    return rows

@router.get("/{mentor_id}/similar", response_model=list[MentorPublicOut])
def get_similar_mentors(mentor_id: str, db: DbSession, lang: RequestLang, limit: int = 4) -> list[MentorPublicOut]:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor or not _mentor_visible_for_public(mentor):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")
        
    query = db.query(Mentor).filter(
        _listed_status_filter(),
        Mentor.is_approved.is_(True),
        Mentor.id != mentor_id
    )
    
    # Try to find mentors with similar expertise
    if mentor.expertise_areas and len(mentor.expertise_areas) > 0:
        exp = mentor.expertise_areas[0]
        query = query.filter(cast(Mentor.expertise_areas, String).ilike(f'%"{exp}"%'))
        
    busy = mentor_ids_with_live_chat(db)
    pricing = get_platform_pricing(db)
    active_pricing = bool(pricing.is_active)
    rows = query.order_by(Mentor.average_rating.desc()).limit(limit).all()

    # If not enough similar, just get top rated
    if len(rows) < limit:
        needed = limit - len(rows)
        existing_ids = [m.id for m in rows] + [mentor_id]
        more_rows = db.query(Mentor).filter(
            _listed_status_filter(),
            Mentor.is_approved.is_(True),
            Mentor.id.notin_(existing_ids)
        ).order_by(Mentor.average_rating.desc()).limit(needed).all()
        rows.extend(more_rows)

    public_rows = [_mentor_public_out(m, busy, session_pricing_active=active_pricing, lang=lang) for m in rows]
    return _dedupe_public_rows(public_rows)
