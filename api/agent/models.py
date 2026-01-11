from typing import Optional

from pydantic import BaseModel


class AgentRequest(BaseModel):
    prompt: str


class TaskResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[str] = None


class SearchRequest(BaseModel):
    prompt: str
    limit: int = 10
    document_set: Optional[str] = None
