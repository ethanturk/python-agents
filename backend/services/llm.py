import logging

from openai import OpenAI
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

import config

logger = logging.getLogger(__name__)


class OpenAIEmbeddings:
    def __init__(self, model_name, api_key=None, api_base=None):
        self.model = model_name
        self.api_key = api_key
        self.api_base = api_base
        # Initialize OpenAI client
        self.client = OpenAI(api_key=api_key, base_url=api_base)

    def embed_documents(self, texts):
        response = self.client.embeddings.create(
            model=self.model,
            input=texts,
        )
        return [r.embedding for r in response.data]

    def embed_query(self, text):
        response = self.client.embeddings.create(
            model=self.model,
            input=[text],
        )
        return response.data[0].embedding


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
        """Returns the OpenAIEmbeddings model (Singleton)."""
        if cls._embedding_model is None:
            logger.info("Initializing OpenAI Embeddings Model...")
            cls._embedding_model = OpenAIEmbeddings(
                model_name=config.OPENAI_EMBEDDING_MODEL,
                api_key=config.OPENAI_API_KEY,
                api_base=config.OPENAI_API_BASE,
            )
        return cls._embedding_model


def get_model():
    return LLMService.get_model()


def get_embeddings_model():
    return LLMService.get_embeddings()
