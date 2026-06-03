from pydantic import BaseModel
from typing import List, Optional


class LiteratureSearchRequest(BaseModel):
    query: str
    max_results: int = 10
    databases: Optional[List[str]] = ["pubmed", "europepmc", "crossref"]
    token: Optional[str] = None


class LitCompareRequest(BaseModel):
    documents: List[dict]  # [{"name": str, "content": str}]
    token: Optional[str] = None


class GapAnalysisRequest(BaseModel):
    startDocument: dict  # {"name": str, "content": str}
    endDocument: dict  # {"name": str, "content": str}
    comparison: str = ""
    token: Optional[str] = None
