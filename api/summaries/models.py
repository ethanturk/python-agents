from typing import Optional

from pydantic import BaseModel


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
    context_results: list[dict]
