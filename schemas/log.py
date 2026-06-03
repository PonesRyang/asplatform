from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_serializer


class GenerationLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token_id: Optional[int] = None
    project_id: Optional[int] = None
    prompt_template_id: Optional[int] = None
    prompt_version: Optional[int] = None
    mode: Optional[str] = None
    input_text: Optional[str] = None
    search_results: Optional[str] = None
    final_prompt: Optional[str] = None
    model_response: Optional[str] = None
    output_content: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    duration_ms: Optional[int] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime

    @field_serializer("created_at")
    def serialize_dt(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


class GenerationLogStats(BaseModel):
    total_calls: int
    success_count: int
    failed_count: int
    timeout_count: int
    total_tokens_used: int
    total_duration_ms: int
    by_mode: list[dict]  # [{mode, count, tokens, avg_duration_ms}]
