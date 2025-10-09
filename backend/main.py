from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from typing import Dict, List

from routes import users, messages, chats
from auth import get_current_user
from websocket import manager


app = FastAPI()
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections: Dict[int, List[WebSocket]] = {}

async def websocket_endpoint(websocket: WebSocket, chat_id: int):
    await websocket.accept()

    if chat_id not in active_connections:
        active_connections[chat_id] = []
    active_connections[chat_id].append(websocket)

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        active_connections[chat_id].remove(websocket)


@app.websocket("/ws/chat/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int):
    await manager.connect(chat_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()

            await manager.broadcast(chat_id, data)
    except:
        manager.disconnect(chat_id, websocket)


@app.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
    }


app.include_router(users.router)
app.include_router(messages.router)
app.include_router(chats.router)
