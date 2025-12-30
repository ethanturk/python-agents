from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider
import nest_asyncio
import asyncio
from qdrant_client import QdrantClient
from langchain_openai import OpenAIEmbeddings
import os
import config

# Apply nest_asyncio to allow nested event loops if necessary
nest_asyncio.apply()

def get_model():
    return OpenAIModel(
        config.OPENAI_MODEL,
        provider=OpenAIProvider(
            base_url=config.OPENAI_API_BASE,
            api_key=config.OPENAI_API_KEY
        )
    )

def run_sync_agent(user_input: str) -> str:
    """
    Synchronous agent:
    Takes input from a user and prompts a LLM with the input. 
    Returns the response.
    """
    if not config.OPENAI_API_KEY:
        return "Error: OPENAI_API_KEY not found in environment variables."

    agent = Agent(
        get_model(),
        system_prompt="You are a helpful assistant."
    )
    
    try:
        result = agent.run_sync(user_input)
        return result.output
    except Exception as e:
        return f"Error running sync agent: {str(e)}"

def search_documents(query: str, limit: int = 10) -> list:
    """
    Search documents in Qdrant (Synchronous).
    Uses search_groups to limit by unique documents (group_by filename) rather than chunks.
    """
    if not config.OPENAI_API_KEY:
        return []

    # Initialize Qdrant and Embeddings
    # Using hardcoded host "qdrant" as per existing pattern for Docker
    qdrant_client = QdrantClient(host=os.getenv("QDRANT_HOST", "qdrant"), port=6333, timeout=60)
    embeddings_model = OpenAIEmbeddings(
        api_key=config.OPENAI_API_KEY, 
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_EMBEDDING_MODEL,
        check_embedding_ctx_length=False
    )

    try:
        qdrant_client.get_collection("documents")
    except:
        return []

    vector = embeddings_model.embed_query(query)
    
    # Use query_points_groups (new API) to group by filename
    # limit = number of groups (documents)
    # group_size = number of chunks per document to retrieve
    response = qdrant_client.query_points_groups(
        collection_name="documents",
        query=vector,
        group_by="filename",
        limit=limit,
        group_size=3
    )
    
    # Flatten the grouped results
    results = []
    for group in response.groups:
        for hit in group.hits:
            results.append({
                "content": hit.payload.get("content"), 
                "metadata": {"filename": hit.payload.get("filename")}
            })
    
    return results

def perform_rag(query: str, limit: int = 10) -> dict:
    """
    Perform RAG: Search -> Context -> LLM Answer.
    """
    if not config.OPENAI_API_KEY:
        return {"answer": "Error: Missing API Key", "results": []}

    results = search_documents(query, limit)
    
    if not results:
        return {
            "answer": "I couldn't find any relevant information in the knowledge base.",
            "results": []
        }

    context_str = "\n\n".join([
        f"Source '{r['metadata']['filename']}':\n{r['content']}" 
        for r in results
    ])

    agent = Agent(
        get_model(),
        system_prompt=(
            "You are a helpful assistant. Answer the user's question based ONLY on the following context. "
            "If the answer is not in the context, say so.\n\n"
        )
    )

    full_prompt = f"Context:\n{context_str}\n\nQuestion: {query}"
    
    try:
        result = agent.run_sync(full_prompt)
        answer = result.output
    except Exception as e:
        answer = f"Error generating answer: {str(e)}"
        
    return {
        "answer": answer,
        "results": results
    }

if __name__ == "__main__":
    print(run_sync_agent("Hello, are you there?"))
