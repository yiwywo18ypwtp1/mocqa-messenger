from pydantic import BaseModel


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
