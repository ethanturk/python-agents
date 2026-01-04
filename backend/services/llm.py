import config
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from langchain_openai import OpenAIEmbeddings
import logging
import litellm

logger = logging.getLogger(__name__)

# Configure LiteLLM to drop unsupported parameters (fixes LM Studio issues)
litellm.drop_params = True

class LLMService:
    _instance = None
    _embedding_model = None

    @classmethod
    def get_model(cls):
        """Returns the configured PydanticAI OpenAIChatModel."""
        return OpenAIChatModel(
            config.OPENAI_MODEL,
            provider=OpenAIProvider(
                base_url=config.OPENAI_API_BASE,
                api_key=config.OPENAI_API_KEY
            )
        )

    @classmethod
    def get_embeddings(cls):
        """Returns the LangChain OpenAIEmbeddings model (Singleton)."""
        if cls._embedding_model is None:
            logger.info("Initializing OpenAI Embeddings Model...")
            cls._embedding_model = OpenAIEmbeddings(
                api_key=config.OPENAI_API_KEY, 
                base_url=config.OPENAI_API_BASE,
                model=config.OPENAI_EMBEDDING_MODEL,
                check_embedding_ctx_length=False
            )
        return cls._embedding_model

def get_model():
    return LLMService.get_model()

def get_embeddings_model():
    return LLMService.get_embeddings()
