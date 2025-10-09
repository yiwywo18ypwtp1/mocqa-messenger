from fastapi import APIRouter, Depends, HTTPException

import bcrypt

from database import get_db, User
from models import UserCreate, UserLogin
from auth import create_access_token


router = APIRouter()

@router.post("/register")
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


@router.post("/login")
def login(user: UserLogin, db=Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()

    if not db_user or not bcrypt.checkpw(user.password.encode(), db_user.password.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users")
def get_users(db=Depends(get_db)):
    try:
        users = db.query(User).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"users": [{"id": user.id, "username": user.username} for user in users]}


@router.delete("/users/{user_id}")
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