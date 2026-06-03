from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from schemas.admin import (
    UserGroupResponse,
    UserGroupCreate,
    AdminUserResponse,
    AdminUserCreate,
    AdminUserUpdate,
)
from schemas.auth import (
    TokenCreate,
    TokenBatchCreate,
    TokenBatchDelete,
    TokenResponse,
)
from utils.auth import get_current_admin, check_permission
from utils.security import get_password_hash
from database import get_db
from models import UserGroup, AdminUser, TokenRecord

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/groups", response_model=List[UserGroupResponse])
def list_groups(db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "group:read")
    return db.query(UserGroup).all()


@router.post("/groups", response_model=UserGroupResponse)
def create_group(group: UserGroupCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "group:write")
    if db.query(UserGroup).filter(UserGroup.name == group.name).first():
        raise HTTPException(status_code=400, detail="Group already exists")
    new_group = UserGroup(**group.dict())
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group


@router.put("/groups/{group_id}", response_model=UserGroupResponse)
def update_group(group_id: int, group: UserGroupCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "group:write")
    db_group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not db_group: raise HTTPException(status_code=404, detail="Group not found")
    db_group.name, db_group.description, db_group.permissions = group.name, group.description, group.permissions
    db.commit()
    return db_group


@router.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "group:write")
    db_group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not db_group: raise HTTPException(status_code=404, detail="Group not found")
    if db_group.name == "SuperAdmin": raise HTTPException(status_code=400, detail="Cannot delete SuperAdmin group")
    if db.query(AdminUser).filter(AdminUser.group_id == group_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete group with associated users")
    db.delete(db_group)
    db.commit()
    return {"message": "Group deleted"}


@router.get("/users", response_model=List[AdminUserResponse])
def list_users(db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "user:read")
    return db.query(AdminUser).all()


@router.post("/users", response_model=AdminUserResponse)
def create_user(user: AdminUserCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "user:write")
    if db.query(AdminUser).filter(AdminUser.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed_pwd = get_password_hash(user.password)
    new_user = AdminUser(**user.dict(exclude={"password"}), hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/users/{user_id}", response_model=AdminUserResponse)
def update_user(user_id: int, user: AdminUserUpdate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "user:write")
    db_user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not db_user: raise HTTPException(status_code=404, detail="User not found")
    for key, value in user.dict(exclude_unset=True).items(): setattr(db_user, key, value)
    db.commit()
    return db_user


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "user:write")
    db_user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not db_user: raise HTTPException(status_code=404, detail="User not found")
    if db_user.username == "admin": raise HTTPException(status_code=400, detail="Cannot delete default admin user")
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted"}


@router.post("/tokens", response_model=TokenResponse)
def create_token(item: TokenCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "token:write")
    new_token_str = secrets.token_hex(16)
    expires = datetime.now(timezone.utc) + timedelta(days=item.expires_days) if item.expires_days else None
    perms_str = ",".join(item.permissions) if isinstance(item.permissions, list) else item.permissions
    db_token = TokenRecord(token=new_token_str, expires_at=expires, ai_quota=item.ai_quota, permissions=perms_str)
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token


@router.post("/tokens/batch", response_model=List[TokenResponse])
def create_tokens_batch(item: TokenBatchCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "token:write")
    count = min(item.count, 100)
    perms_str = ",".join(item.permissions) if isinstance(item.permissions, list) else item.permissions
    expires = datetime.now(timezone.utc) + timedelta(days=item.expires_days) if item.expires_days else None

    new_tokens = []
    for _ in range(count):
        new_token_str = secrets.token_hex(16)
        db_token = TokenRecord(token=new_token_str, expires_at=expires, ai_quota=item.ai_quota, permissions=perms_str)
        db.add(db_token)
        new_tokens.append(db_token)

    db.commit()
    for token in new_tokens:
        db.refresh(token)

    return new_tokens


@router.post("/tokens/batch-delete")
def delete_tokens_batch(request: TokenBatchDelete, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "token:write")
    if not request.token_ids:
        return {"deleted": 0}

    deleted_count = 0
    for token_id in request.token_ids:
        token = db.query(TokenRecord).filter(TokenRecord.id == token_id).first()
        if token:
            db.delete(token)
            deleted_count += 1

    db.commit()
    return {"deleted": deleted_count}


@router.get("/tokens", response_model=List[TokenResponse])
def list_tokens(search: str = None, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "token:read")
    query = db.query(TokenRecord)
    if search: query = query.filter(TokenRecord.token.contains(search))
    return query.all()


@router.delete("/tokens/{token_id}")
def delete_token(token_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "token:write")
    token = db.query(TokenRecord).filter(TokenRecord.id == token_id).first()
    if not token: raise HTTPException(status_code=404, detail="Token not found")
    db.delete(token)
    db.commit()
    return {"message": "Token deleted"}


@router.put("/tokens/{token_id}")
def update_token(token_id: int, request: dict = None, quota: int = None, is_active: bool = None, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    check_permission(current_user, "token:write")
    token = db.query(TokenRecord).filter(TokenRecord.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    # Support both JSON body and query parameters
    ai_quota = quota
    active = is_active
    permissions = None
    expires_at = None

    if request:
        if "ai_quota" in request:
            ai_quota = request["ai_quota"]
        if "is_active" in request:
            active = request["is_active"]
        if "permissions" in request:
            permissions = request["permissions"]
        if "expires_at" in request:
            expires_at = request["expires_at"]

    # Update fields if provided
    if permissions is not None:
        token.permissions = permissions
    if "expires_at" in (request or {}):
        exp_val = request.get("expires_at")
        if exp_val is None or exp_val == '':
            token.expires_at = None
        else:
            try:
                token.expires_at = datetime.fromisoformat(exp_val)
            except:
                pass
    if ai_quota is not None:
        token.ai_quota = ai_quota
    if active is not None:
        token.is_active = active

    db.commit()
    db.refresh(token)
    return {
        "id": token.id,
        "token": token.token,
        "ai_quota": token.ai_quota,
        "used_quota": token.used_quota,
        "is_active": token.is_active,
        "permissions": token.permissions,
        "expires_at": token.expires_at
    }
