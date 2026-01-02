import os
from qdrant_client import QdrantClient
from langchain_openai import OpenAIEmbeddings
import config

# Initialize Qdrant Client (Singleton)
qdrant_client = QdrantClient(host=os.getenv("QDRANT_HOST"), port=6333, timeout=60)

# Global Embeddings Model (Lazy Singleton Pattern or Global)
embeddings_model = OpenAIEmbeddings(
    api_key=config.OPENAI_API_KEY, 
    base_url=config.OPENAI_API_BASE,
    model=config.OPENAI_EMBEDDING_MODEL,
    check_embedding_ctx_length=False
)

def get_qdrant_client():
    return qdrant_client

def get_embeddings_model():
    return embeddings_model
