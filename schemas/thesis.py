from pydantic import BaseModel, ConfigDict, field_serializer
from typing import List, Optional
from datetime import datetime, timezone


class ThesisCreate(BaseModel):
    topic: str
    discipline: str
    language: str = "zh"
    length: str
    style: Optional[str] = "Academic"
    thesis_type: Optional[str] = "Original Research"
    token: Optional[str] = None


# 支持从选题直接创建项目
class ThesisCreateFromTopic(BaseModel):
    topic_title: str  # 选题题目
    discipline: str
    description: Optional[str] = ""  # 选题描述
    language: str = "zh"
    length: str = "Standard (5000 words)"
    style: Optional[str] = "Academic"
    thesis_type: Optional[str] = "Original Research"
    token: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ThesisOutlineRequest(BaseModel):
    project_id: int
    requirements: Optional[str] = None
    references: Optional[List[dict]] = None  # User-uploaded verified references
    style_example: Optional[dict] = None  # User-selected style example
    databases: Optional[List[str]] = None
    token: Optional[str] = None


class ThesisOutlineSaveRequest(BaseModel):
    project_id: int
    outline: str
    token: Optional[str] = None


class ThesisFullTextSaveRequest(BaseModel):
    project_id: int
    content: str
    token: Optional[str] = None


class ThesisDraftSaveRequest(BaseModel):
    project_id: int
    outline: str
    chapters: Optional[list] = None
    references: Optional[List[dict]] = None
    style_example: Optional[dict] = None
    token: Optional[str] = None


class ThesisFullTextRequest(BaseModel):
    project_id: int
    outline: str
    style: Optional[str] = None
    references: Optional[List[dict]] = None
    style_example: Optional[dict] = None
    databases: Optional[List[str]] = None
    token: Optional[str] = None


class ReferenceUploadResponse(BaseModel):
    verified: List[dict]  # successfully verified references
    failed: List[dict]    # files that could not be verified


class ThesisRefineRequest(BaseModel):
    project_id: int
    text: str
    instruction: str  # e.g. "polish", "expand", "summarize"
    token: Optional[str] = None


class ThesisProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    topic: str
    discipline: str
    language: str
    length: str
    style: str
    thesis_type: str
    current_step: int
    created_at: datetime
    updated_at: datetime

    @field_serializer('created_at', 'updated_at')
    def serialize_dt(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)

        return dt.isoformat(timespec='milliseconds').replace('+00:00', 'Z')
