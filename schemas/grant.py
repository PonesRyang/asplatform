from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer


GrantStepKey = Literal["input", "keywords", "topics", "report", "proposal"]


class GrantInputState(BaseModel):
    fund_type: str
    research_area_path: List[str]
    subject: Optional[str] = ""
    disease_path: List[str] = []
    phenotype: Optional[str] = ""
    variable_type: Optional[str] = ""
    variable_name: Optional[str] = ""


class GrantProjectCreate(BaseModel):
    token: Optional[str] = None
    input: GrantInputState


class GrantProjectUpdate(BaseModel):
    token: Optional[str] = None
    title: Optional[str] = None
    current_step: Optional[GrantStepKey] = None
    status: Optional[str] = None
    input: Optional[GrantInputState] = None


class GrantStepAction(BaseModel):
    token: Optional[str] = None


class GrantKeywordPatch(BaseModel):
    token: Optional[str] = None
    keywords: Dict[str, Any]


class GrantTopicSelect(BaseModel):
    token: Optional[str] = None


class GrantStepHistoryItem(BaseModel):
    id: int
    step_key: str
    status: str
    output: Any
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


class GrantConfigOption(BaseModel):
    label: str
    value: str


class GrantConfigTreeNode(GrantConfigOption):
    children: List["GrantConfigTreeNode"] = Field(default_factory=list)


class GrantConfigOptionsResponse(BaseModel):
    fundTypes: List[GrantConfigOption]
    researchAreas: List[GrantConfigTreeNode]
    diseases: List[GrantConfigTreeNode]
    variableTypes: List[GrantConfigOption]
    phenotypes: List[GrantConfigOption]


class GrantProjectSummary(BaseModel):
    id: int
    title: str
    status: str
    current_step: str
    fund_type: str
    research_area_path: List[str]
    updated_at: datetime

    @field_serializer("updated_at")
    def serialize_dt(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


class GrantProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: str
    current_step: str
    input: Dict[str, Any]
    keywords: Dict[str, Any]
    references: List[Dict[str, Any]]
    topics: List[Dict[str, Any]]
    report_sections: List[Dict[str, Any]]
    proposal_sections: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")
