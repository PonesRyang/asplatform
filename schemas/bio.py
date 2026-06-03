from pydantic import BaseModel
from typing import Optional


class AnalyzeRequest(BaseModel):
    type: str
    data: list[dict]
    config: dict
    token: Optional[str] = None
