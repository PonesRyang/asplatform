from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from schemas.log import GenerationLogResponse, GenerationLogStats
from utils.auth import get_current_admin, get_optional_admin, verify_token
from database import get_db
from models import GenerationLog, AdminUser

router = APIRouter(prefix="/api/logs", tags=["generation-logs"])


@router.get("", response_model=list[GenerationLogResponse])
def list_logs(
    token_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    mode: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search in input_text / output_content"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    token: Optional[str] = Query(None, description="Service token (filters to token owner)"),
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    """
    Query generation logs with optional filters.
    - Admin users: see all logs
    - Service token: see only own logs
    """
    query = db.query(GenerationLog)

    # Auth: if using service token, restrict to that token's logs
    if not current_user and token:
        token_record = verify_token(token, db)
        token_id = token_record.id
    elif current_user and hasattr(current_user, "group") and getattr(getattr(current_user, "group", None), "name", None) != "SuperAdmin":
        # Non-admin users (future: restrict to own projects)
        pass

    if token_id is not None:
        query = query.filter(GenerationLog.token_id == token_id)
    if project_id is not None:
        query = query.filter(GenerationLog.project_id == project_id)
    if mode:
        query = query.filter(GenerationLog.mode == mode)
    if status:
        query = query.filter(GenerationLog.status == status)
    if search:
        like = f"%{search}%"
        from sqlalchemy import or_
        query = query.filter(or_(
            GenerationLog.input_text.ilike(like),
            GenerationLog.output_content.ilike(like),
            GenerationLog.mode.ilike(like),
        ))
    if date_from:
        query = query.filter(GenerationLog.created_at >= date_from)
    if date_to:
        query = query.filter(GenerationLog.created_at <= date_to)

    query = query.order_by(GenerationLog.created_at.desc())
    return query.offset(offset).limit(limit).all()


@router.get("/stats", response_model=GenerationLogStats)
def get_log_stats(
    token_id: Optional[int] = Query(None),
    mode: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    """Get aggregate statistics of generation logs."""
    query = db.query(GenerationLog)

    # Auth
    if not current_user and token:
        token_record = verify_token(token, db)
        token_id = token_record.id

    if token_id is not None:
        query = query.filter(GenerationLog.token_id == token_id)
    if mode:
        query = query.filter(GenerationLog.mode == mode)
    if date_from:
        query = query.filter(GenerationLog.created_at >= date_from)
    if date_to:
        query = query.filter(GenerationLog.created_at <= date_to)

    base = query  # Keep filtered query for aggregates

    total_calls = base.count()
    success_count = base.filter(GenerationLog.status == "success").count()
    failed_count = base.filter(GenerationLog.status == "failed").count()
    timeout_count = base.filter(GenerationLog.status == "timeout").count()

    tokens_result = base.with_entities(
        func.coalesce(func.sum(GenerationLog.total_tokens), 0),
        func.coalesce(func.sum(GenerationLog.duration_ms), 0),
    ).first()
    total_tokens_used = int(tokens_result[0]) if tokens_result else 0
    total_duration_ms = int(tokens_result[1]) if tokens_result else 0

    # By-mode breakdown
    by_mode_rows = (
        base.with_entities(
            GenerationLog.mode,
            func.count().label("cnt"),
            func.coalesce(func.sum(GenerationLog.total_tokens), 0).label("tok"),
            func.coalesce(func.avg(GenerationLog.duration_ms), 0).label("avg_dur"),
        )
        .group_by(GenerationLog.mode)
        .all()
    )
    by_mode = [
        {
            "mode": row.mode or "unknown",
            "count": row.cnt,
            "tokens": int(row.tok),
            "avg_duration_ms": round(float(row.avg_dur)),
        }
        for row in by_mode_rows
    ]

    return GenerationLogStats(
        total_calls=total_calls,
        success_count=success_count,
        failed_count=failed_count,
        timeout_count=timeout_count,
        total_tokens_used=total_tokens_used,
        total_duration_ms=total_duration_ms,
        by_mode=by_mode,
    )


@router.get("/{log_id}", response_model=GenerationLogResponse)
def get_log_detail(
    log_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    """Get a single generation log with full detail (prompt, response, etc.)."""
    log = db.query(GenerationLog).filter(GenerationLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    # Auth: token owner or admin
    if not current_user and token:
        token_record = verify_token(token, db)
        if log.token_id and log.token_id != token_record.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    return log
