from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.conns: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        if user_id not in self.conns:
            self.conns[user_id] = []
        self.conns[user_id].append(ws)

    def disconnect(self, user_id: int, ws: WebSocket):
        if user_id in self.conns:
            if ws in self.conns[user_id]:
                self.conns[user_id].remove(ws)
            if not self.conns[user_id]:
                del self.conns[user_id]

    async def publish(self, user_id: int, event: dict):
        if user_id in self.conns:
            # Send to all connections for this user
            for ws in self.conns[user_id]:
                try:
                    await ws.send_json(event)
                except Exception:
                    # If send fails, we could remove it, but let disconnect handle it
                    pass
