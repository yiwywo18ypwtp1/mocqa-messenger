from fastapi import WebSocket

from typing import List


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, chat_id: int, websocket: WebSocket):
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)

    def disconnect(self, chat_id: int, websocket: WebSocket):
        self.active_connections[chat_id].remove(websocket)
        if not self.active_connections[chat_id]:
            del self.active_connections[chat_id]

    async def broadcast(self, chat_id: int, message: dict):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id]:
                await connection.send_json(message)

manager = ConnectionManager()

