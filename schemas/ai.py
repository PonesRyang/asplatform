from pydantic import BaseModel
from typing import Optional


class AIRequest(BaseModel):
    text: str
    mode: str
    token: Optional[str] = None
    instruction: Optional[str] = None
    incomplete_prefix: Optional[str] = None
    incomplete_suffix: Optional[str] = None
    # Tool-specific options
    intensity: Optional[str] = None  # conservative/standard/deep for polish, light/medium/deep for rewrite
    style: Optional[str] = None  # academic/journal/thesis for polish
    direction: Optional[str] = None  # auto/zh2en/en2zh for translate
    level: Optional[str] = None  # basic/detailed for grammar
    preserve_terms: Optional[str] = None  # comma-separated terms to preserve
    format: Optional[str] = None  # structured/unstructured for abstract
    word_count: Optional[int] = None  # target word count for abstract
    target_multiplier: Optional[float] = None  # length multiplier for expand
    expand_direction: Optional[str] = None  # theory/methods/data/comprehensive


class EnhanceLiteratureRequest(BaseModel):
    text: str
    citations: str = ""
    token: Optional[str] = None
