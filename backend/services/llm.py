import logging

import litellm
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

import config

logger = logging.getLogger(__name__)

# Configure LiteLLM to drop unsupported parameters (fixes LM Studio issues)
litellm.drop_params = True


class LiteLLMEmbeddings:
    def __init__(self, model_name, api_key=None, api_base=None):
        self.model = model_name
        self.api_key = api_key
        self.api_base = api_base

    def embed_documents(self, texts):
        response = litellm.embedding(
            model=self.model,
            input=texts,
            api_key=self.api_key,
            api_base=self.api_base,
            drop_params=True,  # Drop unsupported params like encoding_format
        )
        return [r["embedding"] for r in response.data]

    def embed_query(self, text):
        response = litellm.embedding(
            model=self.model,
            input=[text],
            api_key=self.api_key,
            api_base=self.api_base,
            drop_params=True,
        )
        return response.data[0]["embedding"]


class LLMService:
    _instance = None
    _embedding_model = None

    @classmethod
    def get_model(cls):
        """Returns the configured PydanticAI OpenAIChatModel."""
        return OpenAIChatModel(
            config.OPENAI_MODEL,
            provider=OpenAIProvider(base_url=config.OPENAI_API_BASE, api_key=config.OPENAI_API_KEY),
        )

    @classmethod
    def get_embeddings(cls):
        """Returns the LiteLLMEmbeddings model (Singleton)."""
        if cls._embedding_model is None:
            logger.info("Initializing LiteLLM Embeddings Model...")
            cls._embedding_model = LiteLLMEmbeddings(
                model_name=config.OPENAI_EMBEDDING_MODEL,
                api_key=config.OPENAI_API_KEY,
                api_base=config.OPENAI_API_BASE,
            )
        return cls._embedding_model


def get_model():
    return LLMService.get_model()


def get_embeddings_model():
    return LLMService.get_embeddings()
