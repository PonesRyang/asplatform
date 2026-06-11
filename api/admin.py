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
    GrantConfigItemCreate,
    GrantConfigItemResponse,
    GrantConfigItemUpdate,
    LiteratureDatabaseConfigResponse,
    LiteratureDatabaseConfigUpdate,
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
from models import UserGroup, AdminUser, TokenRecord, GrantConfigItem, LiteratureDatabaseConfig
from services.literature_sources import ensure_literature_database_seed, update_literature_database_config

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _grant_config_response(item: GrantConfigItem, db: Session) -> GrantConfigItemResponse:
    parent_label = None
    if item.parent_id:
        parent = db.query(GrantConfigItem).filter(GrantConfigItem.id == item.parent_id).first()
        parent_label = parent.label if parent else None

    return GrantConfigItemResponse(
        id=item.id,
        category=item.category,
        label=item.label,
        value=item.value,
        parent_id=item.parent_id,
        depends_on_category=item.depends_on_category or None,
        depends_on_value=item.depends_on_value or None,
        parent_label=parent_label,
        sort_order=item.sort_order or 0,
        is_active=item.is_active,
        source=item.source,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _validate_grant_config_parent(db: Session, category: str, parent_id: Optional[int], item_id: Optional[int] = None):
    if not parent_id:
        return
    if item_id and parent_id == item_id:
        raise HTTPException(status_code=400, detail="配置项不能选择自己作为上级")
    parent = db.query(GrantConfigItem).filter(GrantConfigItem.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=400, detail="上级配置项不存在")
    if parent.category != category:
        raise HTTPException(status_code=400, detail="上级配置项必须属于同一分类")


def _assert_grant_config_unique(
    db: Session,
    category: str,
    value: str,
    parent_id: Optional[int],
    item_id: Optional[int] = None,
):
    query = db.query(GrantConfigItem).filter(
        GrantConfigItem.category == category,
        GrantConfigItem.value == value,
        GrantConfigItem.parent_id == parent_id,
    )
    if item_id:
        query = query.filter(GrantConfigItem.id != item_id)
    if query.first():
        raise HTTPException(status_code=400, detail="同一上级下已存在相同配置值")


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


@router.get("/grant-config", response_model=List[GrantConfigItemResponse])
def list_grant_config_items(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    check_permission(current_user, "grant_config:read")
    query = db.query(GrantConfigItem)
    if category:
        query = query.filter(GrantConfigItem.category == category)
    if search:
        query = query.filter(
            (GrantConfigItem.label.contains(search)) |
            (GrantConfigItem.value.contains(search)) |
            (GrantConfigItem.source.contains(search))
        )
    items = query.order_by(
        GrantConfigItem.category.asc(),
        GrantConfigItem.parent_id.asc().nullsfirst(),
        GrantConfigItem.sort_order.asc(),
        GrantConfigItem.id.asc(),
    ).all()
    return [_grant_config_response(item, db) for item in items]


@router.post("/grant-config", response_model=GrantConfigItemResponse)
def create_grant_config_item(
    item: GrantConfigItemCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    check_permission(current_user, "grant_config:write")
    value = (item.value or item.label).strip()
    label = item.label.strip()
    category = item.category.strip()
    if not category or not label:
        raise HTTPException(status_code=400, detail="分类和名称不能为空")

    _validate_grant_config_parent(db, category, item.parent_id)
    _assert_grant_config_unique(db, category, value, item.parent_id)

    db_item = GrantConfigItem(
        category=category,
        label=label,
        value=value,
        parent_id=item.parent_id,
        depends_on_category=item.depends_on_category,
        depends_on_value=item.depends_on_value,
        sort_order=item.sort_order,
        is_active=item.is_active,
        source=item.source,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return _grant_config_response(db_item, db)


@router.put("/grant-config/{item_id}", response_model=GrantConfigItemResponse)
def update_grant_config_item(
    item_id: int,
    payload: GrantConfigItemUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    check_permission(current_user, "grant_config:write")
    db_item = db.query(GrantConfigItem).filter(GrantConfigItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="配置项不存在")

    updates = payload.dict(exclude_unset=True)
    label = updates.get("label", db_item.label)
    value = updates.get("value", db_item.value) or label
    parent_id = updates.get("parent_id", db_item.parent_id)

    _validate_grant_config_parent(db, db_item.category, parent_id, item_id)
    _assert_grant_config_unique(db, db_item.category, value, parent_id, item_id)

    if "label" in updates:
        db_item.label = label.strip()
    if "value" in updates or "label" in updates:
        db_item.value = str(value).strip()
    if "parent_id" in updates:
        db_item.parent_id = parent_id
    if "depends_on_category" in updates:
        db_item.depends_on_category = updates["depends_on_category"] or None
    if "depends_on_value" in updates:
        db_item.depends_on_value = updates["depends_on_value"] or None
    if "sort_order" in updates:
        db_item.sort_order = updates["sort_order"]
    if "is_active" in updates:
        db_item.is_active = updates["is_active"]
    if "source" in updates:
        db_item.source = updates["source"]
    db_item.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_item)
    return _grant_config_response(db_item, db)


@router.delete("/grant-config/{item_id}")
def delete_grant_config_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    check_permission(current_user, "grant_config:write")
    db_item = db.query(GrantConfigItem).filter(GrantConfigItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="配置项不存在")
    if db.query(GrantConfigItem).filter(GrantConfigItem.parent_id == item_id).first():
        raise HTTPException(status_code=400, detail="请先删除或迁移下级配置项")

    db.delete(db_item)
    db.commit()
    return {"message": "配置项已删除"}


@router.get("/literature-databases", response_model=List[LiteratureDatabaseConfigResponse])
def list_literature_databases(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    check_permission(current_user, "grant_config:read")
    ensure_literature_database_seed(db)
    return db.query(LiteratureDatabaseConfig).order_by(
        LiteratureDatabaseConfig.sort_order.asc(),
        LiteratureDatabaseConfig.id.asc(),
    ).all()


@router.put("/literature-databases/{item_id}", response_model=LiteratureDatabaseConfigResponse)
def update_literature_database(
    item_id: int,
    payload: LiteratureDatabaseConfigUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    check_permission(current_user, "grant_config:write")
    db_item = db.query(LiteratureDatabaseConfig).filter(LiteratureDatabaseConfig.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="文献库配置不存在")

    updates = payload.dict(exclude_unset=True)
    if "modules" in updates:
        modules = {part.strip() for part in (updates["modules"] or "").split(",") if part.strip()}
        allowed_modules = {"all", "grant", "writing", "literature"}
        if not modules or not modules.issubset(allowed_modules):
            raise HTTPException(status_code=400, detail="适用模块仅支持 all, grant, writing, literature")
        updates["modules"] = ",".join(sorted(modules))
    if "name" in updates and not (updates["name"] or "").strip():
        raise HTTPException(status_code=400, detail="文献库名称不能为空")

    db_item = update_literature_database_config(db_item, updates)
    db.commit()
    db.refresh(db_item)
    return db_item


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
