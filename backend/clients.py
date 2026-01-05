import os

from langchain_openai import OpenAIEmbeddings
import config

# Initialize Qdrant Client (Removed)
# qdrant_client = ...

# Global Embeddings Model (Lazy Singleton Pattern or Global)
embeddings_model = OpenAIEmbeddings(
    api_key=config.OPENAI_API_KEY, 
    base_url=config.OPENAI_API_BASE,
    model=config.OPENAI_EMBEDDING_MODEL,
    check_embedding_ctx_length=False
)

def get_embeddings_model():
    return embeddings_model
