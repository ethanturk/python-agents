import os
from dotenv import load_dotenv

load_dotenv()

# Celery Configuration
# RabbitMQ Broker URL
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'amqp://guest:guest@192.168.5.200:5672//')
CELERY_RESULT_BACKEND = 'rpc://'

# OpenAI / Local LLM Configuration
# Pointing to LM Studio
OPENAI_API_BASE = os.getenv('OPENAI_API_BASE') or 'http://192.168.5.203:1234/v1'
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY') or 'lm-studio' # Dummy key for local LLM
OPENAI_MODEL = os.getenv('OPENAI_MODEL') or 'gpt-oss-20b'

API_URL = os.getenv('API_URL', 'http://192.168.5.200:9999')