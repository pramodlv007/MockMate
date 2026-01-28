from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas
from ..database import get_db

from .auth import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

# All /me routes MUST come before /{user_id} routes to avoid path conflicts

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.put("/me/profile", response_model=schemas.User)
def update_my_profile(
    profile: schemas.UserProfileUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.update_user_profile(db, current_user.id, profile)

@router.get("/me/interviews", response_model=List[schemas.InterviewSession])
def read_my_interviews(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    interviews = crud.get_user_interviews(db, user_id=current_user.id)
    return interviews

# Dynamic routes with {user_id} come after /me routes

@router.get("/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_user = crud.get_user(db, user_id=user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.get("/{user_id}/interviews", response_model=List[schemas.InterviewSession])
def read_user_interviews(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    interviews = crud.get_user_interviews(db, user_id=user_id, skip=skip, limit=limit)
    return interviews
