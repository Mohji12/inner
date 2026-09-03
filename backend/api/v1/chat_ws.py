from datetime import datetime, timezone
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.security import verify_access_token
from db.session import SessionLocal
from models.mentor import Mentor
from models.user import User
from services.chat_hub import chat_hub
from services.chat_service import ChatError, get_session_for_participant
from services.live_session_service import record_participant_join
from services.session_billing_service import process_session_heartbeat
from services.presence_service import presence_service

router = APIRouter()


async def _reject_websocket(websocket: WebSocket, code: int = 1008) -> None:
    """Accept then close so browsers get a proper WS close (not HTTP 403)."""
    await websocket.accept()
    await websocket.close(code=code)


@router.websocket("/ws/chat/{session_id}")
async def chat_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str | None = Query(None),
) -> None:
    if not token:
        await _reject_websocket(websocket)
        return
    payload = verify_access_token(token)
    if not payload:
        await _reject_websocket(websocket)
        return
    role = payload.get("role")
    sub = payload.get("sub")
    if not sub or not role:
        await _reject_websocket(websocket)
        return

    db = SessionLocal()
    user_id: str | None = None
    mentor_id: str | None = None
    try:
        if role == "user":
            user = db.query(User).filter(User.id == sub).first()
            if not user or user.account_status != "active":
                await _reject_websocket(websocket)
                return
            user_id = user.id
        elif role == "mentor":
            mentor = db.query(Mentor).filter(Mentor.id == sub).first()
            if not mentor:
                await _reject_websocket(websocket)
                return
            mentor_id = mentor.id
        else:
            await _reject_websocket(websocket)
            return
        try:
            get_session_for_participant(db, session_id, user_id, mentor_id)
        except ChatError:
            await _reject_websocket(websocket)
            return
    finally:
        db.close()

    await chat_hub.connect(session_id, websocket)

    join_db = SessionLocal()
    try:
        timer_just_started = record_participant_join(join_db, session_id, role)
        if timer_just_started:
            from api.v1.chat import _session_out
            from models.chat_session import ChatSession

            session = join_db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if session:
                payload = _session_out(session).model_dump(mode="json")
                await chat_hub.broadcast(session_id, {"type": "session", "data": payload})
    finally:
        join_db.close()

    presence_service.set_online(sub, role)

    try:
        while True:
            # Receive message from client
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "ping":
                    presence_service.set_online(sub, role)
                    # Use a dedicated DB session per tick (auth session is closed before this loop).
                    billing_db = SessionLocal()
                    try:
                        billing = process_session_heartbeat(billing_db, session_id=session_id)
                        billing_db.commit()
                        await websocket.send_json(
                            {
                                "type": "billing_tick",
                                "data": {
                                    "status": billing.get("status"),
                                    "remaining_hold": billing.get("remaining_hold"),
                                },
                            }
                        )
                    except Exception:
                        billing_db.rollback()
                        # Billing should not break presence ping/pong for legacy clients.
                        pass
                    finally:
                        billing_db.close()
                    await websocket.send_json({"type": "pong"})
                
                elif msg_type == "typing":
                    # Broadcast typing status to others in the room
                    await chat_hub.broadcast(session_id, {
                        "type": "typing",
                        "data": {
                            "role": role,
                            "is_typing": data.get("data", {}).get("is_typing", False)
                        }
                    })
            except Exception:
                # If recipient sent non-json, ignore or break
                try:
                    await websocket.receive_text()
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        chat_hub.disconnect(session_id, websocket)
        presence_service.set_offline(sub, role)
        
        # Update last_seen_at in DB
        db = SessionLocal()
        try:
            if role == "user":
                db.query(User).filter(User.id == sub).update({"last_seen_at": datetime.now(timezone.utc)})
            elif role == "mentor":
                db.query(Mentor).filter(Mentor.id == sub).update({"last_seen_at": datetime.now(timezone.utc)})
            db.commit()
        finally:
            db.close()

