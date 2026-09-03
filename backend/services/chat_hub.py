"""In-process WebSocket fan-out for chat sessions (single-server MVP)."""

from collections import defaultdict

from fastapi import WebSocket


class ChatHub:
    def __init__(self) -> None:
        self._rooms: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms[session_id].append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        lst = self._rooms.get(session_id)
        if not lst:
            return
        if websocket in lst:
            lst.remove(websocket)
        if not lst:
            del self._rooms[session_id]

    async def broadcast(self, session_id: str, payload: dict) -> None:
        targets = list(self._rooms.get(session_id, []))
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(session_id, ws)


chat_hub = ChatHub()
