from pydantic import BaseModel, ConfigDict, field_serializer
from typing import List, Optional
from datetime import datetime, timezone


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenCreate(BaseModel):
    ai_quota: int = 1000000
    permissions: str | List[str] = "bio,ai"
    expires_days: Optional[int] = 30


class TokenBatchCreate(TokenCreate):
    count: int = 1


class TokenBatchDelete(BaseModel):
    token_ids: List[int]


class TokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token: str
    created_at: datetime
    expires_at: Optional[datetime]
    is_active: bool
    ai_quota: int
    used_quota: int
    permissions: str

    @field_serializer('created_at', 'expires_at')
    def serialize_dt(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)

        return dt.isoformat(timespec='milliseconds').replace('+00:00', 'Z')
