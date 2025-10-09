from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form

import os
from datetime import datetime, timedelta

from database import get_db, User, Message, Chat, ChatParticipant
from models import MessageSend, MessageEdit
from auth import get_current_user
from utils import UPLOAD_DIR
from websocket import manager
from utils import security


router = APIRouter()

@router.post("/messages")
async def send_message(
    chat_id: int = Form(...),
    content: str = Form(None),
    reply_content: str = Form(None),
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
        reply_content=reply_content,
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
        "reply_content": new_message.reply_content,
        "image_url": new_message.image_url,
        "sent_time": new_message.sent_time.isoformat(),
        "sender_username": current_user.username
    }
    await manager.broadcast(chat.id, message_data)

    return {"message": "Message sent successfully", "message_details": message_data}


@router.get("/messages")
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
            "reply_content": msg.reply_content,
            "sent_time": msg.sent_time,
            "image_url": msg.image_url,
            "sender": {
                "id": sender.id,
                "username": sender.username,
                "display_name": sender.display_name
            }
        })

    return {"messages": result}


@router.delete("/messages/{message_id}")
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


@router.patch("/messages/{message_id}")
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