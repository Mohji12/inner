from datetime import datetime, timezone
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.security import verify_access_token
from db.session import SessionLocal
from models.mentor import Mentor
from models.user import User
from services.chat_hub import chat_hub
from services.chat_service import ChatError, get_session_for_participant
from services.live_session_service import activate_session_on_participant_join
from services.session_billing_service import process_session_heartbeat
from services.presence_service import presence_service

router = APIRouter()


@router.websocket("/ws/chat/{session_id}")
async def chat_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str | None = Query(None),
) -> None:
    if not token:
        await websocket.close(code=1008)
        return
    payload = verify_access_token(token)
    if not payload:
        await websocket.close(code=1008)
        return
    role = payload.get("role")
    sub = payload.get("sub")
    if not sub or not role:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    user_id: str | None = None
    mentor_id: str | None = None
    try:
        if role == "user":
            user = db.query(User).filter(User.id == sub).first()
            if not user or user.account_status != "active":
                await websocket.close(code=1008)
                return
            user_id = user.id
        elif role == "mentor":
            mentor = db.query(Mentor).filter(Mentor.id == sub).first()
            if not mentor:
                await websocket.close(code=1008)
                return
            mentor_id = mentor.id
        else:
            await websocket.close(code=1008)
            return
        try:
            get_session_for_participant(db, session_id, user_id, mentor_id)
        except ChatError:
            await websocket.close(code=1008)
            return
    finally:
        db.close()

    await chat_hub.connect(session_id, websocket)

    join_db = SessionLocal()
    try:
        activate_session_on_participant_join(join_db, session_id)
    finally:
        join_db.close()

    if role == "mentor":
        presence_service.set_offline(sub, role)
    else:
        presence_service.set_online(sub, role)
    
    try:
        while True:
            # Receive message from client
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "ping":
                    if role == "mentor":
                        presence_service.set_offline(sub, role)
                    else:
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

