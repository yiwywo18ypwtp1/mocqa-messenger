from fastapi import FastAPI, Request, Response, HTTPException, Depends, status, Query, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from psycopg2 import IntegrityError
from sqlalchemy import func
import jwt
from datetime import datetime, timedelta
from typing import Dict, List
import shutil
import os
from dotenv import load_dotenv

from database import get_db, User, Chat, ChatParticipant, Message
import bcrypt

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

security = HTTPBearer()

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

class UserCreate(BaseModel):
    username: str
    display_name: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class CreateChatRequest(BaseModel):
    username: str

class MessageSend(BaseModel):
    chat_id: int
    content: str

class MessageEdit(BaseModel):
    new_content: str

class CurrentChat(BaseModel):
    chat_id: str


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(request: Request, db=Depends(get_db)):
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")

    token = auth_header.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")

        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")

    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.username == username).first()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, List[WebSocket]] = {}  # ключ — chat_id

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


@app.post("/register")
def register(user: UserCreate, db=Depends(get_db)):
    try:
        user_exists = db.query(User).filter(User.username == user.username).first()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if user_exists:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_password = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()

    new_user = User(
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        password=hashed_password,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error creating user")

    return {"message": "User created successfully", "user": {"id": new_user.id, "username": new_user.username}}


@app.post("/login")
def login(user: UserLogin, db=Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()

    if not db_user or not bcrypt.checkpw(user.password.encode(), db_user.password.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/users")
def get_users(db=Depends(get_db)):
    try:
        users = db.query(User).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"users": [{"id": user.id, "username": user.username} for user in users]}


@app.delete("/users/{user_id}")
def delete_user(user_id: int, db=Depends(get_db)):
    try:
        user_exists = db.query(User).filter(User.id == user_id).first()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        db.delete(user_exists)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "User deleted successfully", "deleted_user": {user_exists.username}}


@app.post("/chats")
def create_chat(request_data: CreateChatRequest, current_user=Depends(get_current_user), db=Depends(get_db), credentials=Depends(security)):
    other_user = db.query(User).filter(User.username == request_data.username).first()

    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_chat = (
        db.query(Chat)
        .join(ChatParticipant)
        .filter(ChatParticipant.user_id.in_([current_user.id, other_user.id]))
        .group_by(Chat.id)
        .having(func.count(Chat.id) == 2)
        .first()
    )

    if existing_chat:
        return {"chat_id": existing_chat.id, "message": "Chat already exists"}

    new_chat = Chat()
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    participants = [
        ChatParticipant(chat_id=new_chat.id, user_id=current_user.id),
        ChatParticipant(chat_id=new_chat.id, user_id=other_user.id),
    ]
    db.add_all(participants)
    db.commit()

    return {
        "chat_id": new_chat.id,
        "participants": [
            {"id": current_user.id, "username": current_user.username},
            {"id": other_user.id, "username": other_user.username},
        ],
    }


@app.get("/chats")
def get_chats(db=Depends(get_db), current_user=Depends(get_current_user), credentials=Depends(security)):
    chats = (
        db.query(Chat)
        .join(ChatParticipant)
        .filter(ChatParticipant.user_id == current_user.id)
        .all()
    )

    result = []
    for chat in chats:
        participants = (
            db.query(User)
            .join(ChatParticipant)
            .filter(ChatParticipant.chat_id == chat.id)
            .all()
        )
        result.append({
            "chat_id": chat.id,
            "participants": [
                {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name
            } for user in participants ]
        })

    return {"chats": result}


@app.post("/messages")
async def send_message(
    chat_id: int = Form(...),
    content: str = Form(None),
    image: UploadFile = File(None),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    credentials=Depends(security)
):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    participant = db.query(ChatParticipant).filter(
        ChatParticipant.chat_id == chat.id,
        ChatParticipant.user_id == current_user.id
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="User not a participant of the chat")

    image_url = None
    if image:
        file_path = os.path.join(UPLOAD_DIR, image.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/uploads/{image.filename}"

    if not content and not image_url:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    new_message = Message(
        chat_id=chat.id,
        sender_id=current_user.id,
        content=content,
        image_url=image_url,
        sent_time=datetime.utcnow()
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    message_data = {
        "id": new_message.id,
        "chat_id": new_message.chat_id,
        "sender_id": new_message.sender_id,
        "content": new_message.content,
        "image_url": new_message.image_url,
        "sent_time": new_message.sent_time.isoformat(),
        "sender_username": current_user.username
    }

    await manager.broadcast(chat.id, message_data)

    return {"message": "Message sent successfully", "message_details": message_data}


@app.get("/messages")
def get_messages_in_chat(chat_id: int = Query(...), current_user=Depends(get_current_user), db=Depends(get_db), credentials=Depends(security)):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    participant = db.query(ChatParticipant).filter(
        ChatParticipant.chat_id == chat.id,
        ChatParticipant.user_id == current_user.id
    ).first()

    if not participant:
        raise HTTPException(status_code=403, detail="User not a participant of the chat")

    messages = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.sent_time).all()

    result = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        
        result.append({
            "id": msg.id,
            "chat_id": msg.chat_id,
            "content": msg.content,
            "sent_time": msg.sent_time,
            "image_url": msg.image_url,
            "sender": {
                "id": sender.id,
                "username": sender.username,
                "display_name": sender.display_name
            }
        })

    return {"messages": result}


@app.delete("/messages/{message_id}")
async def delete_message(message_id: int, current_user=Depends(get_current_user), db=Depends(get_db), credentials=Depends(security)):
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can't delete this message")

    chat_id = message.chat_id

    try:
        db.delete(message)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    event = {
        "action": "delete_message",
        "message_id": message_id
    }
    await manager.broadcast(chat_id, event)

    return {"message": "Message deleted successfully", "deleted_message": {"message_id": message.id, "content": message.content}}


@app.patch("/messages/{message_id}")
async def delete_message(message_id: int, new_message: MessageEdit, current_user=Depends(get_current_user), db=Depends(get_db), credentials=Depends(security)):
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can't delete this message")

    message.content = new_message.new_content

    chat_id = message.chat_id

    try:
        db.commit()
        db.refresh(message)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    event = {
        "action": "edit_message",
        "message_id": message.id,
        "new_content": message.content
    }
    await manager.broadcast(chat_id, event)

    return {"message": "Message edited successfully", "edit_message": {"message_id": message.id, "content": message.content}}