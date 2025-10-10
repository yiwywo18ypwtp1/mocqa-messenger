from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func

from database import get_db, User, Chat, ChatParticipant
from models import CreateChatRequest
from auth import get_current_user
from utils import security


router = APIRouter()

@router.post("/chats")
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


@router.get("/chats")
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