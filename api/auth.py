from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from schemas.auth import Token
from schemas.admin import AdminUserResponse, PasswordChange
from utils.auth import create_access_token, get_current_admin, verify_token, ACCESS_TOKEN_EXPIRE_MINUTES
from utils.security import verify_password, get_password_hash
from database import get_db
from models import AdminUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=AdminUserResponse)
async def read_users_me(current_user: AdminUser = Depends(get_current_admin)):
    return current_user


@router.put("/password")
async def change_password(pwd_data: PasswordChange, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    if not verify_password(pwd_data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    current_user.hashed_password = get_password_hash(pwd_data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/verify-service-token")
async def verify_service_token_endpoint(request: dict, db: Session = Depends(get_db)):
    token = request.get("token")
    if not token: raise HTTPException(status_code=400, detail="Token is required")
    try:
        record = verify_token(token, db)
        return {
            "valid": True,
            "permissions": record.permissions,
            "ai_quota": record.ai_quota,
            "used_quota": record.used_quota,
            "expires_at": record.expires_at
        }
    except HTTPException as e:
        return {"valid": False, "detail": e.detail}
