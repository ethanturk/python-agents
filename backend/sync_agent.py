from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from qdrant_client import QdrantClient
from langchain_openai import OpenAIEmbeddings
import config

def run_sync_agent(user_input: str) -> str:
    """
    Synchronous agent:
    Takes input from a user and prompts a LLM with the input. 
    Returns the response.
    """
    if not config.OPENAI_API_KEY:
        return "Error: OPENAI_API_KEY not found in environment variables."

    llm = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_MODEL
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant."),
        ("user", "{input}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        response = chain.invoke({"input": user_input})
        return response
    except Exception as e:
        return f"Error running sync agent: {str(e)}"

def search_documents(query: str) -> list:
    """
    Search documents in Qdrant (Synchronous).
    """
    if not config.OPENAI_API_KEY:
        return []

    # Initialize Qdrant and Embeddings
    # Using hardcoded host "qdrant" as per existing pattern for Docker
    qdrant_client = QdrantClient(host="qdrant", port=6333)
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
    response = qdrant_client.query_points(
        collection_name="documents",
        query=vector,
        limit=25
    )
    search_result = response.points
    
    return [
        {"content": hit.payload.get("content"), "metadata": {"filename": hit.payload.get("filename")}}
        for hit in search_result
    ]

def perform_rag(query: str) -> dict:
    """
    Perform RAG: Search -> Context -> LLM Answer.
    """
    if not config.OPENAI_API_KEY:
        return {"answer": "Error: Missing API Key", "results": []}

    results = search_documents(query)
    
    if not results:
        return {
            "answer": "I couldn't find any relevant information in the knowledge base.",
            "results": []
        }

    context_str = "\n\n".join([
        f"Source '{r['metadata']['filename']}':\n{r['content']}" 
        for r in results
    ])

    llm = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_MODEL
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. Answer the user's question based ONLY on the following context. If the answer is not in the context, say so.\n\nContext:\n{context}"),
        ("user", "{input}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    try:
        answer = chain.invoke({"input": query, "context": context_str})
    except Exception as e:
        answer = f"Error generating answer: {str(e)}"
        
    return {
        "answer": answer,
        "results": results
    }

if __name__ == "__main__":
    print(run_sync_agent("Hello, are you there?"))
