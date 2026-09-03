"""Quick WebSocket connectivity test (run on EC2 with venv)."""
from __future__ import annotations

import asyncio
import sys


async def main() -> int:
    try:
        import websockets
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets", "-q"])
        import websockets

    url = sys.argv[1] if len(sys.argv) > 1 else "wss://life.mijnlevenspad.com/api/v1/ws/chat/test-id?token=not-a-jwt"
    print("connecting", url)
    try:
        async with websockets.connect(url, open_timeout=15) as ws:
            print("CONNECTED", ws.subprotocol)
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            print("recv", msg)
    except websockets.exceptions.ConnectionClosedError as e:
        print("CLOSED_AFTER_HANDSHAKE code=", e.code, "reason=", e.reason)
        return 0
    except Exception as e:
        print("FAIL", type(e).__name__, e)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
