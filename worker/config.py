import os

from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("BASE_URL") or "192.168.5.204"

# Celery Configuration
# Redis Broker URL (supports both RabbitMQ and Redis for backwards compatibility)
# For multi-instance deployment, use Redis: redis://default:password@host:port  # pragma: allowlist secret
CELERY_BROKER_URL = os.getenv(  # pragma: allowlist secret
    "CELERY_BROKER_URL", f"amqp://guest:guest@{BASE_URL}:5672//"  # pragma: allowlist secret
)
# Use Redis result backend when broker is Redis, otherwise use RPC
if CELERY_BROKER_URL and CELERY_BROKER_URL.startswith("redis://"):
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)
else:
    CELERY_RESULT_BACKEND = "rpc://"

# OpenAI / Local LLM Configuration
# Pointing to LM Studio
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE") or "http://192.168.5.203:1234/v1"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or "lm-studio"  # Dummy key for local LLM
OPENAI_MODEL = os.getenv("OPENAI_MODEL") or "gpt-oss-20b"
OPENAI_EMBEDDING_MODEL = (
    os.getenv("OPENAI_EMBEDDING_MODEL") or "text-embedding-nomic-embed-text-v1.5"
)
OPENAI_EMBEDDING_DIMENSIONS = int(os.getenv("OPENAI_EMBEDDING_DIMENSIONS") or "768")

API_URL = os.getenv("API_URL")

# Multi-tenancy Configuration
# Database Configuration
# Supabase REST Credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

DATABASE_CONN_STRING = os.getenv("DATABASE_CONN_STRING")
VECTOR_TABLE_NAME = os.getenv("VECTOR_TABLE_NAME") or "documents"
CELERY_QUEUE_NAME = os.getenv("CELERY_QUEUE_NAME") or "celery"

# Azure Storage Configuration (Central US region)
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER_NAME") or "documents"
AZURE_STORAGE_ACCOUNT_NAME = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")


# Deployment Configuration
RUN_WORKER_EMBEDDED = os.getenv("RUN_WORKER_EMBEDDED", "false").lower() == "true"
