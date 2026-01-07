import asyncio
import base64
import logging
import os
from io import BytesIO

import httpx
from celery import Celery
from pydantic_ai import Agent

import config
from services.ingestion import ingestion_service
from services.llm import get_model
from summarizer import summarize_document

logger = logging.getLogger(__name__)
os.environ["USE_NNPACK"] = "0"

# Initialize Celery
app = Celery(
    "langchain_agent_sample", broker=config.CELERY_BROKER_URL, backend=config.CELERY_RESULT_BACKEND
)
app.conf.task_default_queue = config.CELERY_QUEUE_NAME


@app.task
def check_knowledge_base(user_input):
    """Step 1: Check if KB exists (Legacy Stub Logic)."""
    # Logic remains similar but simplified
    if not config.OPENAI_API_KEY:
        return {"error": "Missing API Key"}

    _agent = Agent(get_model(), system_prompt="You are an intelligent assistant.")
    kb_path = "stub_knowledge_base.txt"
    if not os.path.exists(kb_path):
        with open(kb_path, "w") as f:
            f.write("Answer is 42.")

    return {"user_input": user_input, "kb_location": kb_path}


@app.task
def answer_question(context_data):
    """Step 2: Answer question."""
    if "error" in context_data:
        return f"Error: {context_data['error']}"

    user_input = context_data.get("user_input")
    kb_content = "42"  # Simplified for brevity as this is a demo chain

    agent = Agent(get_model(), system_prompt=f"Answer using: {kb_content}")
    return agent.run_sync(user_input).output


async def _ingest_docs_async(files_data, use_vlm=False):
    """Async helper for ingestion tasks."""
    try:
        results = []

        for file_item in files_data:
            filename = file_item["filename"]
            try:
                if use_vlm:
                    res = await ingestion_service.process_file_vlm(
                        filename,
                        content=file_item.get("content"),
                        filepath=file_item.get("filepath"),
                        document_set=file_item.get("document_set", "default"),
                    )
                else:
                    res = await ingestion_service.process_file(
                        filename,
                        content=file_item.get("content"),
                        filepath=file_item.get("filepath"),
                        document_set=file_item.get("document_set", "default"),
                    )
                results.append(res)
            except Exception as e:
                logger.error(f"Failed processing {filename}: {e}")
                results.append(f"Failed {filename}: {e}")

        return "\n".join(results)
    except Exception as e:
        logger.error(f"Ingestion task failed: {e}")
        raise
    # Note: DO NOT close db_service - it's a global singleton shared across tasks
    # In Celery workers, each process has its own copy, managed by worker lifecycle


@app.task
def ingest_docs_task(files_data):
    """Ingest a list of files using IngestionService."""
    return asyncio.run(_ingest_docs_async(files_data, use_vlm=False))


@app.task
def ingest_docs_vlm_task(files_data):
    """Ingest a list of files using IngestionService with VLM pipeline."""
    return asyncio.run(_ingest_docs_async(files_data, use_vlm=True))


@app.task(name="async_tasks.summarize_document_task")
def summarize_document_task(filename: str, content_b64: str, backend_notify_url: str):
    """Async task to summarize a document."""
    try:
        content = base64.b64decode(content_b64)
        source = BytesIO(content)
        summary = summarize_document(source, filename)

        status = "completed" if "Error" not in summary else "failed"

        with httpx.Client() as client:
            client.post(
                backend_notify_url,
                json={
                    "type": "summary_complete",
                    "filename": filename,
                    "status": status,
                    "result": summary,
                },
            )
        return summary
    except Exception as e:
        return f"Task failed: {e}"
