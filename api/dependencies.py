from __future__ import annotations

from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from utils.auth import verify_token
from database import get_db
from models import TokenRecord


async def verify_service_access(db: Session, token: str = None, required_perm: str = "ai"):
    """Verify token access and check quota. Does NOT deduct quota."""
    if not token:
        raise HTTPException(status_code=401, detail="Access token required")
    record = verify_token(token, db, required_perm)
    # Check quota if it's an AI call
    if required_perm == "ai":
        if record.ai_quota > 0 and record.used_quota >= record.ai_quota:
            raise HTTPException(status_code=403, detail="Token 额度不足")
    return record


def deduct_token_quota(db: Session, token_id: int, token_usage: int):
    """Deduct token quota based on actual token usage (input + output tokens)."""
    if token_usage <= 0:
        return  # No usage to deduct
    record = db.query(TokenRecord).filter(TokenRecord.id == token_id).first()
    if record:
        record.used_quota += token_usage
        db.commit()
