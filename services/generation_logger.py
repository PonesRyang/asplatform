"""Generation log service — writes full audit trail for every AI call."""

import json
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from models import GenerationLog


def log_generation(
    db: Session,
    *,
    mode: str,
    status: str = "pending",
    token_id: Optional[int] = None,
    project_id: Optional[int] = None,
    input_text: Optional[str] = None,
    search_results: Optional[list | dict] = None,
    final_prompt: Optional[str] = None,
    model_response: Optional[str] = None,
    output_content: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    prompt_template_id: Optional[int] = None,
    prompt_version: Optional[int] = None,
) -> GenerationLog:
    """Write a generation log entry. Returns the created log for later updating."""

    log = GenerationLog(
        token_id=token_id,
        project_id=project_id,
        mode=mode,
        status=status,
        input_text=input_text[:10000] if input_text else None,
        search_results=json.dumps(search_results, ensure_ascii=False) if search_results else None,
        final_prompt=final_prompt[:50000] if final_prompt else None,
        model_response=model_response[:50000] if model_response else None,
        output_content=output_content[:50000] if output_content else None,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        duration_ms=duration_ms,
        error_message=error_message[:2000] if error_message else None,
        prompt_template_id=prompt_template_id,
        prompt_version=prompt_version,
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    return log


def update_log_status(
    db: Session,
    log: GenerationLog,
    *,
    status: str,
    model_response: Optional[str] = None,
    output_content: Optional[str] = None,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
):
    """Update a log entry with final results (used for deferred writes)."""
    log.status = status
    if model_response:
        log.model_response = model_response[:50000]
    if output_content:
        log.output_content = output_content[:50000]
    if prompt_tokens:
        log.prompt_tokens = prompt_tokens
    if completion_tokens:
        log.completion_tokens = completion_tokens
    if total_tokens:
        log.total_tokens = total_tokens
    if duration_ms is not None:
        log.duration_ms = duration_ms
    if error_message:
        log.error_message = error_message[:2000]
    db.commit()
