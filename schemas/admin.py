from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer
from typing import Optional


class UserGroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: str


class UserGroupCreate(UserGroupBase):
    pass


class UserGroupResponse(UserGroupBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class AdminUserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    group_id: Optional[int] = None


class AdminUserCreate(AdminUserBase):
    password: str


class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    group_id: Optional[int] = None


class AdminUserResponse(AdminUserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    group: Optional[UserGroupResponse] = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class AdminPasswordReset(BaseModel):
    new_password: str


class GrantConfigItemBase(BaseModel):
    category: str
    label: str
    value: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int = 0
    is_active: bool = True
    source: Optional[str] = None


class GrantConfigItemCreate(GrantConfigItemBase):
    pass


class GrantConfigItemUpdate(BaseModel):
    label: Optional[str] = None
    value: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    source: Optional[str] = None


class GrantConfigItemResponse(GrantConfigItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_label: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")
