import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv('BASE_URL') or '192.168.5.204'

# Celery Configuration
# RabbitMQ Broker URL
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', f"amqp://guest:guest@{BASE_URL}:5672//")
CELERY_RESULT_BACKEND = 'rpc://'

# OpenAI / Local LLM Configuration
# Pointing to LM Studio
OPENAI_API_BASE = os.getenv('OPENAI_API_BASE') or 'http://192.168.5.203:1234/v1'
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY') or 'lm-studio' # Dummy key for local LLM
OPENAI_MODEL = os.getenv('OPENAI_MODEL') or 'gpt-oss-20b'
OPENAI_EMBEDDING_MODEL = os.getenv('OPENAI_EMBEDDING_MODEL') or 'text-embedding-nomic-embed-text-v1.5'
OPENAI_EMBEDDING_DIMENSIONS = int(os.getenv('OPENAI_EMBEDDING_DIMENSIONS') or '768')

API_URL = os.getenv('API_URL')

# Multi-tenancy Configuration
QDRANT_COLLECTION_NAME = os.getenv('QDRANT_COLLECTION_NAME') or 'documents'
CELERY_QUEUE_NAME = os.getenv('CELERY_QUEUE_NAME') or 'celery'

# File Monitoring
MONITORED_DIR = os.getenv("MONITORED_DIR", "/data/monitored")

