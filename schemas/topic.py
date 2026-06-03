from pydantic import BaseModel
from typing import List, Optional


# Topic Generation Schemas
class TopicGenerationRequest(BaseModel):
    discipline: str  # 学科领域
    research_direction: Optional[str] = None  # 研究方向
    keywords: Optional[List[str]] = None  # 核心关键词
    count: int = 5  # 生成选题数量
    token: Optional[str] = None


class TopicAnalysisRequest(BaseModel):
    topic: str  # 选题题目
    discipline: str  # 学科领域
    token: Optional[str] = None


class TopicRefineRequest(BaseModel):
    topic: str
    discipline: str
    requirements: str
    token: Optional[str] = None


class ThesisTopic(BaseModel):
    title: str
    discipline_field: str
    research_hotspot: str
    innovation_level: str  # high/medium/low
    difficulty_level: str  # high/medium/low
    feasibility: str  # high/medium/low
    description: str
    extended_directions: List[str]


class TopicAnalysisResult(BaseModel):
    topic: str
    similar_papers: List[dict]
    similarity_score: float  # 0-100
    analysis: dict
    research_background: str
    research_significance: str
    feasibility_analysis: str
    potential_innovations: List[str]
    extended_directions: List[str]
    recommended_references: List[dict]
