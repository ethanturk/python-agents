# Configuration Guide: OpenRouter Platform

## Overview

The application is **already configured** to work with OpenRouter platform. It uses:
- **LiteLLM**: OpenRouter-compatible LLM abstraction library
- **PydanticAI**: OpenAI-compatible model provider with custom base_url support

## Current Configuration (Local LM Studio)

Your `.env.example` currently points to a local LM Studio instance:
```bash
OPENAI_API_BASE=https://llms.home.ethanturk.com
OPENAI_API_KEY=lm-studio
OPENAI_MODEL=lm_studio/gpt-oss-20b
OPENAI_EMBEDDING_MODEL=lm_studio/text-embedding-nomic-embed-text-v1.5
```

## Configuration for OpenRouter

To use OpenRouter, update your `.env` file with:

```bash
# OpenRouter Configuration
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_KEY=sk-or-v1-YOUR_OPENROUTER_API_KEY_HERE
OPENAI_MODEL=openai/gpt-4o-mini

# OpenRouter supports these embedding models:
OPENAI_EMBEDDING_MODEL=openai/text-embedding-ada-002
# Alternative: openai/text-embedding-3-small

# Keep these the same
OPENAI_EMBEDDING_DIMENSIONS=1536
```

## Available Models on OpenRouter

Check [OpenRouter Models](https://openrouter.ai/models) for available models:

### Chat Models (OPENAI_MODEL):
- `openai/gpt-4o-mini` - Fast, affordable
- `openai/gpt-4o` - Latest GPT-4o
- `openai/gpt-4-turbo` - Previous generation
- `openai/gpt-3.5-turbo` - Cost-effective
- Plus many more providers (Anthropic, Google, Meta, etc.)

### Embedding Models (OPENAI_EMBEDDING_MODEL):
- `openai/text-embedding-ada-002` - 1536 dimensions
- `openai/text-embedding-3-small` - 1536 dimensions
- `openai/text-embedding-3-large` - 3072 dimensions

## Code Verification

### backend/config.py ✅
```python
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE")  # Can be OpenRouter URL
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")    # OpenRouter API key
OPENAI_MODEL = os.getenv("OPENAI_MODEL")          # OpenRouter model name
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL")
```

### backend/services/llm.py ✅
```python
# Uses LiteLLM (OpenRouter-compatible)
import litellm

# Uses PydanticAI with custom base_url
OpenAIProvider(base_url=config.OPENAI_API_BASE, api_key=config.OPENAI_API_KEY)
```

### backend/requirements.txt ✅
```text
litellm          # OpenRouter-compatible
pydantic-ai      # OpenAI-compatible provider
```

## Example .env for OpenRouter

```bash
# OpenRouter Platform
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_KEY=sk-or-v1-abc123xyz...
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_EMBEDDING_MODEL=openai/text-embedding-ada-002
OPENAI_EMBEDDING_DIMENSIONS=1536

# RabbitMQ / Celery
BASE_URL=192.168.5.204
CELERY_BROKER_URL=amqp://guest:guest@192.168.5.204:5672//
CELERY_QUEUE_NAME=aidocsrch-southhaven

# API
API_URL=http://192.168.5.204:9998
BACKEND_PORT=9998

# Azure Storage (from migration)
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_STORAGE_CONTAINER_NAME=documents
AZURE_STORAGE_ACCOUNT_NAME=aidocsrch

# Supabase
SUPABASE_URL=https://bmxgswgckbsofuqnqrsg.supabase.co
SUPABASE_KEY=...

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://aidocs.ethanturk.com
MAX_FILE_SIZE=100000000
MAX_FILES_PER_UPLOAD=10
FIREBASE_REQUIRED=false
```

## Getting OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Navigate to API Keys section
3. Copy your API key (starts with `sk-or-v1-`)

## Testing the Configuration

### 1. Verify .env
```bash
grep OPENAI .env
```

Expected output:
```
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_KEY=sk-or-v1-...
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_EMBEDDING_MODEL=openai/text-embedding-ada-002
```

### 2. Test LLM Service
```bash
cd backend
python3 << 'EOF'
from services.llm import LLMService

model = LLMService.get_model()
print(f"Model: {model}")
print(f"Model Name: {model.model_name}")
print(f"Provider Base URL: {model.provider.base_url}")

embeddings = LLMService.get_embeddings_model()
print(f"Embeddings Model: {embeddings.model}")
EOF
'
```

### 3. Run Backend
```bash
docker-compose build backend
docker-compose up backend
```

### 4. Check Logs
```bash
docker-compose logs backend | grep -i "openrouter\|llm\|embedding"
```

## Expected Behavior with OpenRouter

### ✅ Chat Endpoint (/agent/sync)
- Uses `OPENAI_MODEL` (e.g., `openai/gpt-4o-mini`)
- Routes to OpenRouter: `https://openrouter.ai/api/v1/chat/completions`
- Returns chat responses

### ✅ RAG Search (/agent/search)
- Uses `OPENAI_EMBEDDING_MODEL` for embeddings
- Generates embeddings via OpenRouter: `https://openrouter.ai/api/v1/embeddings`
- Stores in Supabase pgvector
- Performs semantic search

### ✅ Document Ingestion (/agent/ingest)
- Uses `OPENAI_EMBEDDING_MODEL` for chunk embeddings
- Batch processes documents
- Stores vectors in Supabase

## Cost Considerations

OpenRouter pricing (as of 2024):
- **gpt-4o-mini**: ~$0.15/1M input tokens
- **gpt-4o**: ~$2.50/1M input tokens
- **text-embedding-ada-002**: ~$0.0001/1K tokens

Example costs for 100 document queries:
- Embeddings (1M tokens): ~$0.10
- Chat (1M tokens): ~$0.15
- **Total**: ~$0.25

## Troubleshooting

### Issue: "OpenRouter API key not found"
**Solution**: Check `.env` has correct `OPENAI_API_KEY`

### Issue: "Model not found on OpenRouter"
**Solution**: Check model name at https://openrouter.ai/models

### Issue: "401 Unauthorized"
**Solution**:
- Verify API key is valid
- Check API key hasn't expired
- Ensure no trailing spaces in API key

### Issue: Embeddings too slow
**Solution**:
- Use `text-embedding-ada-002` (faster than v3)
- Check OpenRouter rate limits
- Consider increasing `OPENAI_EMBEDDING_DIMENSIONS` only if needed

## Migration Checklist

When switching from LM Studio to OpenRouter:

- [ ] Update `OPENAI_API_BASE` to `https://openrouter.ai/api/v1`
- [ ] Update `OPENAI_API_KEY` to your OpenRouter key
- [ ] Update `OPENAI_MODEL` to OpenRouter model name
- [ ] Update `OPENAI_EMBEDDING_MODEL` to OpenRouter embedding model
- [ ] Update `OPENAI_EMBEDDING_DIMENSIONS` (1536 for ada-002, 3072 for v3-large)
- [ ] Test chat endpoint
- [ ] Test search endpoint
- [ ] Test document ingestion
- [ ] Monitor OpenRouter costs

## Compatibility Summary

| Component | Compatible with OpenRouter? | Notes |
|-----------|----------------------------|-------|
| LiteLLM | ✅ Yes | Native OpenRouter support |
| PydanticAI | ✅ Yes | Custom base_url support |
| Backend Config | ✅ Yes | Environment-based |
| .env | ⚠️ Needs Update | Current config points to LM Studio |
| Docker Compose | ✅ Yes | Uses environment variables |
| Azure Storage | ✅ Independent | No LLM dependency |
| Supabase | ✅ Independent | No LLM dependency |

## Conclusion

✅ **The application is FULLY COMPATIBLE with OpenRouter**

All code is already set up to work with OpenRouter. You only need to:
1. Get an OpenRouter API key
2. Update your `.env` file with OpenRouter configuration
3. Restart the application

No code changes required. The application uses LiteLLM which provides a unified interface to OpenAI-compatible APIs including OpenRouter.
