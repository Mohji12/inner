"""Diagnose coach login vs public availability on production."""

import sys
from datetime import datetime, timezone

sys.path.insert(0, "/home/ubuntu/inner/backend")

from sqlalchemy import text
from db.session import SessionLocal
from services.presence_service import presence_service, last_seen_is_online
from services.chat_service import mentor_chat_busy, mentor_ids_with_live_chat
from services.mentor_unavailability_service import load_unavailability_by_mentor, is_unavailable_now
from services.mentor_availability_service import compute_chat_available, mentor_manual_occupied
from services.pricing_service import effective_chat_price_per_minute_eur
from models.mentor import Mentor

ANJA_ID = "f212a0de-dd11-4223-8635-88d0ba128618"
PAUL_ID = "240a2533-e2d2-4060-a1a6-5533353053fd"


def diagnose_mentor(db, mentor: Mentor, busy_ids: set[str]) -> dict:
    online_mem = presence_service.is_online_memory(mentor.id, "mentor")
    online = presence_service.is_online(mentor.id, "mentor", last_seen_at=mentor.last_seen_at)
    busy = mentor_chat_busy(db, mentor.id)
    umap = load_unavailability_by_mentor(db, [mentor.id])
    unavail = is_unavailable_now(umap.get(mentor.id, []))
    occupied = mentor_manual_occupied(db, mentor.id)
    chat_rate = effective_chat_price_per_minute_eur(mentor)
    chat_available = compute_chat_available(
        online=online,
        busy=mentor.id in busy_ids,
        unavailable_schedule=unavail,
        manual_occupied=occupied,
    )

    last_seen = mentor.last_seen_at
    secs_ago = None
    if last_seen:
        ls = last_seen if last_seen.tzinfo else last_seen.replace(tzinfo=timezone.utc)
        secs_ago = (datetime.now(timezone.utc) - ls).total_seconds()

    reasons = []
    if not online:
        reasons.append("mentor_offline")
    if busy:
        reasons.append("mentor_busy")
    if unavail:
        reasons.append("mentor_unavailable")
    if occupied:
        reasons.append("mentor_occupied")
    if chat_rate <= 0:
        reasons.append("chat_disabled")

    coach_status = (
        "busy"
        if busy
        else ("occupied" if occupied and online else ("online" if online else "offline"))
    )

    return {
        "id": mentor.id,
        "name": mentor.full_name,
        "email": mentor.email,
        "coach_dashboard_status": coach_status,
        "user_availability": (
            "unavailable"
            if unavail
            else (
                "offline"
                if not online
                else ("occupied" if occupied else ("available" if chat_available else "busy"))
            )
        ),
        "is_online": online,
        "is_online_memory": online_mem,
        "last_seen_at": str(last_seen),
        "last_seen_seconds_ago": round(secs_ago, 1) if secs_ago is not None else None,
        "last_seen_fresh": last_seen_is_online(last_seen),
        "chat_busy": busy,
        "unavailable_now": unavail,
        "manual_occupied": occupied,
        "chat_rate": str(chat_rate),
        "chat_available": chat_available,
        "mismatch": coach_status == "online" and not chat_available,
        "block_reasons": reasons,
    }


def stuck_sessions(db, mentor_id: str):
    now = datetime.now(timezone.utc)
    rows = db.execute(
        text(
            """
            SELECT id, status, timer_started_at, allocated_duration_minutes,
                   ends_at, created_at, updated_at
            FROM chat_sessions
            WHERE mentor_id = :mid
              AND (
                (status = 'active' AND ends_at > :now)
                OR (status = 'paused' AND allocated_duration_minutes IS NOT NULL AND timer_started_at IS NULL)
              )
            ORDER BY created_at DESC
            LIMIT 10
            """
        ),
        {"mid": mentor_id, "now": now.replace(tzinfo=None)},
    ).fetchall()
    return rows


with SessionLocal() as db:
    busy_ids = mentor_ids_with_live_chat(db)
    print("=== BUSY MENTOR IDS (live/join-window) ===")
    print(sorted(busy_ids))
    print()

    mentors = (
        db.query(Mentor)
        .filter(Mentor.status == "active", Mentor.is_approved.is_(True))
        .order_by(Mentor.last_seen_at.desc())
        .limit(15)
        .all()
    )

    print("=== RECENTLY ACTIVE COACHES (top 15 by last_seen_at) ===")
    mismatches = []
    for m in mentors:
        d = diagnose_mentor(db, m, busy_ids)
        flag = " *** MISMATCH" if d["mismatch"] else ""
        print(
            f"{d['name']!r} | dashboard={d['coach_dashboard_status']} user={d['user_availability']}"
            f" | last_seen={d['last_seen_seconds_ago']}s ago | reasons={d['block_reasons']}{flag}"
        )
        if d["mismatch"]:
            mismatches.append(d)

    print()
    print("=== MISMATCHES (coach sees online, users not available) ===")
    if not mismatches:
        print("None among recently active coaches right now.")
    for d in mismatches:
        print(d)
        stuck = stuck_sessions(db, d["id"])
        if stuck:
            print("  stuck sessions:", stuck)

    print()
    print("=== FOCUS: Anja Thomas ===")
    anja = db.query(Mentor).filter(Mentor.id == ANJA_ID).first()
    if anja:
        d = diagnose_mentor(db, anja, busy_ids)
        print(d)
        print("  stuck sessions:", stuck_sessions(db, ANJA_ID))

    print()
    print("=== FOCUS: Paul Henry Osselaer ===")
    paul = db.query(Mentor).filter(Mentor.id == PAUL_ID).first()
    if paul:
        d = diagnose_mentor(db, paul, busy_ids)
        print(d)
        print("  stuck sessions:", stuck_sessions(db, PAUL_ID))

    print()
    print("=== ALL COACHES: online in last 24h but NOT chat_available ===")
    rows = db.execute(
        text(
            """
            SELECT id, full_name, email, last_seen_at
            FROM mentors
            WHERE status = 'active' AND is_approved = 1
              AND last_seen_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
            ORDER BY last_seen_at DESC
            """
        )
    ).fetchall()
    for row in rows:
        m = db.query(Mentor).filter(Mentor.id == row[0]).first()
        if not m:
            continue
        d = diagnose_mentor(db, m, busy_ids)
        if d["coach_dashboard_status"] == "online" or (d["last_seen_seconds_ago"] or 999) < 3600:
            if not d["chat_available"]:
                print(f"  {d['name']} | user={d['user_availability']} | reasons={d['block_reasons']} | last_seen={d['last_seen_seconds_ago']}s")
