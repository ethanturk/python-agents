from typing import Optional

from pydantic import BaseModel


class AgentRequest(BaseModel):
    prompt: str


class TaskResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[str] = None


class IngestRequest(BaseModel):
    files: list[dict]  # List of {"filename": "foo.txt", "content": "..."}


class SearchRequest(BaseModel):
    prompt: str
    limit: int = 10
    document_set: Optional[str] = None


class SummarizeRequest(BaseModel):
    filename: str


class NotificationRequest(BaseModel):
    type: str
    filename: str
    status: str
    result: str


class SummaryQARequest(BaseModel):
    filename: str
    question: str


class SearchQARequest(BaseModel):
    question: str
    context_results: list[dict]  # List of results from search response
