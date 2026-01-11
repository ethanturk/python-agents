"""
Summaries service wrapper for serverless deployment.

This module provides a thin wrapper around backend summary services,
using minimal dependencies (pydantic-ai, supabase).
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys_path = str(backend_dir)
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

# Import services from backend
import nest_asyncio
from pydantic_ai import Agent

import config
from database import get_all_summaries, get_summary, init_db
from services.agent import run_qa_agent

logger = logging.getLogger(__name__)

# Apply nest_asyncio for async/sync compatibility
nest_asyncio.apply()


def get_summaries():
    """Get all summaries."""
    return get_all_summaries()


def summary_qa(filename: str, question: str):
    """QA on a document summary."""
    summary_record = get_summary(filename)
    if not summary_record:
        return {"answer": "Summary not found. Please summarize the document first."}

    return {"answer": run_qa_agent(summary_record["summary_text"], question)}


def search_qa(question: str, context_results: list[dict]):
    """QA on search results."""
    context_str = "\n\n".join(
        [
            f"Source '{r['metadata'].get('filename', 'Unknown')}':\n{r.get('content', '')}"
            for r in context_results
        ]
    )
    return {"answer": run_qa_agent(context_str, question)}


async def summarize_document(filename: str):
    """Submit document summarization task to queue service."""
    from services.queue_service import init_queue_service
    from common.config import API_URL

    queue = init_queue_service()

    task_id = await queue.submit_task("summarize", {"filename": filename})

    webhook_url = f"{API_URL}/internal/notify"
    return {"task_id": task_id, "webhook": webhook_url}
