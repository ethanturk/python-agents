import logging

import nest_asyncio
from pydantic_ai import Agent

import config
from services.llm import get_model
from services.vector_db import db_service

logger = logging.getLogger(__name__)

# Apply nest_asyncio
nest_asyncio.apply()


def run_sync_agent(user_input: str) -> str:
    """Simple chat agent."""
    if not config.OPENAI_API_KEY:
        return "Error: OPENAI_API_KEY not found."

    agent = Agent(get_model(), system_prompt="You are a helpful assistant.")

    try:
        result = agent.run_sync(user_input)
        return result.output
    except Exception as e:
        return f"Error running agent: {str(e)}"


def perform_rag(query: str, limit: int = 10, document_set: str = None) -> dict:
    """RAG Workflow."""
    if not config.OPENAI_API_KEY:
        return {"answer": "Error: Missing API Key", "results": []}

    results = db_service.search(query, limit, document_set)

    if not results:
        return {
            "answer": "I couldn't find any relevant information in the knowledge base.",
            "results": [],
        }

    context_str = "\n\n".join(
        [f"Source '{r['metadata']['filename']}':\n{r['content']}" for r in results]
    )

    agent = Agent(
        get_model(),
        system_prompt=(
            "You are a helpful assistant. Answer the user's question based ONLY on the following context. "
            "If the answer is not in the context, say so.\n\n"
        ),
    )

    full_prompt = f"Context:\n{context_str}\n\nQuestion: {query}"

    try:
        result = agent.run_sync(full_prompt)
        answer = result.output
    except Exception as e:
        answer = f"Error generating answer: {str(e)}"

    return {"answer": answer, "results": results}


def run_qa_agent(context: str, question: str) -> str:
    """Runs QA on provided context."""
    agent = Agent(
        get_model(),
        system_prompt="You are an assistant answering questions based oNLY on the provided context.",
    )
    user_prompt = f"Context:\n{context}\n\nQuestion: {question}"
    result = agent.run_sync(user_prompt)
    return result.output
