from pydantic import BaseModel, ConfigDict
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
