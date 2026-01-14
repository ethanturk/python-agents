# LangChain Agent System

A scalable, production-ready RAG-based LLM application built as a monorepo with serverless backend functions, a modern Next.js frontend, and distributed Python workers for async processing.

## 🏗️ Architecture

This is a **Turborepo monorepo** with three main applications:

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Next.js    │─────▶│  Node.js Backend │─────▶│   Python    │
│  Frontend   │      │  (Vercel Funcs)  │      │   Worker    │
│             │      │                  │      │(Azure Queue)│
└─────────────┘      └──────────────────┘      └─────────────┘
                              │                        │
                              ▼                        ▼
                     ┌─────────────────────────────────────┐
                     │  Supabase (Vector DB + Postgres)    │
                     │  Azure Blob Storage (Files)         │
                     │  Azure Storage Queues (Task Queue)  │
                     └─────────────────────────────────────┘
```

### Applications

#### 📦 `apps/backend` - Node.js Serverless Backend

**Tech Stack:** TypeScript, Vercel Functions, OpenAI, Supabase, Firebase Auth, Azure Blob Storage

**API Endpoints:**
- `/api/agent/*` - LLM agent interactions (RAG, QA, search)
- `/api/documents/*` - Document management and upload
- `/api/summaries/*` - Document summarization
- `/api/notifications/*` - Long-polling notifications
- `/api/poll` - Real-time status updates

**Key Features:**
- Serverless functions with 10s max duration
- Firebase authentication
- Azure Blob Storage for file uploads
- Supabase vector search for RAG
- SQLite for metadata (sql.js in-memory)
- Long-polling notification system

**Deployment:** Vercel (auto-deploy on push to `main` via GitHub Actions)

#### 🎨 `apps/web` - Next.js Frontend

**Tech Stack:** Next.js 16, React 18, TypeScript, Tailwind CSS, Radix UI, Firebase Auth

**Features:**
- Server and client components
- Firebase authentication context
- Real-time polling for task updates
- File upload with drag-and-drop
- Document management UI
- Chat interface with RAG
- Markdown rendering for responses

**Deployment:** Vercel (auto-deploy on push to `main` via GitHub Actions)

#### ⚙️ `apps/worker` - Python Async Worker

**Tech Stack:** Python 3.11+, Azure Queue, LangChain, pydantic-ai, Docling, Supabase

**Task Types:**
- **Document Ingestion** - Process PDFs, XLSX, DOCX with Docling → chunk → embed → index
- **Summarization** - Async document summarization with LLM
- **File Watching** - Auto-trigger ingestion on new files

**Key Dependencies:**
- `azure-storage-queue` - Azure Queue polling
- `langchain-openai` - LLM integration
- `docling[vlm]` - Document processing with vision models
- `supabase` - Vector DB client
- `azure-storage-blob` - File storage client

**Deployment:** Docker Hub (auto-deploy on push to `main` via GitHub Actions)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **pnpm** 9+
- **Docker** and **Docker Compose** (for local worker)
- **Python** 3.11+ (for worker development)
- **OpenAI API Key** or compatible endpoint
- **Supabase** project with vector extension enabled
- **Firebase** project for authentication
- **Azure Storage** account (optional, for file uploads)

### Environment Setup

1. **Clone and install dependencies:**

```bash
git clone <repo-url>
cd python-agents
corepack enable
pnpm install
```

2. **Configure environment variables:**

Create `.env` files in each app directory:

**`apps/backend/.env`:**
```bash
# LLM Configuration
OPENAI_API_KEY=sk-...
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Supabase (Vector DB)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
VECTOR_TABLE_NAME=documents

# Firebase Admin (Backend Auth)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Azure Storage (File Uploads)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER_NAME=documents

# Task Queue (for notifications)
REDIS_URL=redis://localhost:6379
```

**`apps/web/.env.local`:**
```bash
# API Endpoint
NEXT_PUBLIC_API_BASE=http://localhost:3001/api
# For production: NEXT_PUBLIC_API_BASE=https://your-backend.vercel.app/api

# Firebase (Client Auth)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**`apps/worker/.env`:**
```bash
# LLM Configuration
OPENAI_API_KEY=sk-...
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Supabase (Vector DB)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# Azure Storage (Queue and File Processing)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER_NAME=documents

# Worker Configuration
CLIENT_ID=your-client-id
API_URL=https://your-backend.vercel.app

# File Monitoring (optional)
MONITORED_DIR=/app/monitored
```

### Development

**Start all services with Turborepo:**

```bash
# Run all apps in dev mode
pnpm dev

# Or run specific apps
pnpm --filter web dev          # Frontend only
pnpm --filter backend dev      # Backend only (note: serverless, use Vercel CLI)
```

**Run worker locally:**

```bash
cd apps/worker
pip install -r requirements.txt
python main.py
```

**Or use Docker Compose:**

```bash
# Start worker
docker-compose -f docker-compose.worker.yml up -d
```

### Testing

**Run all tests:**
```bash
pnpm test
```

**Run specific tests:**
```bash
pnpm --filter web test         # Frontend tests (Vitest)
pnpm --filter backend test     # Backend tests (Vitest)
cd apps/worker && pytest       # Worker tests (pytest)
```

**Pre-commit hooks:**
```bash
# Install hooks (includes linting, formatting, tests)
./setup-precommit.sh

# Run manually
pre-commit run --all-files
```

### Building

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter web build
pnpm --filter backend build
```

## 📚 API Documentation

### Authentication

All API endpoints (except `/health` and `/api/poll`) require Firebase authentication:

```javascript
// Include Firebase ID token in Authorization header
headers: {
  'Authorization': `Bearer ${firebaseIdToken}`
}
```

### Endpoints

#### Agent Endpoints (`/api/agent/*`)

- `POST /api/agent/chat` - Synchronous RAG chat
- `POST /api/agent/search` - Semantic search in document sets
- `POST /api/agent/summary_qa` - Question answering on summaries

#### Document Endpoints (`/api/documents/*`)

- `GET /api/documents/documentsets` - List all document sets
- `GET /api/documents?document_set=<name>` - List documents in a set
- `POST /api/documents/upload` - Upload files (multipart/form-data)
- `DELETE /api/documents/:filename` - Delete a document

#### Summaries Endpoints (`/api/summaries/*`)

- `POST /api/summaries/summarize` - Trigger async summarization
- `GET /api/summaries` - List all summaries
- `GET /api/summaries/:filename` - Get specific summary

#### Notifications (`/api/notifications/*`)

- `GET /api/poll?since_id=<id>` - Long-poll for task updates (8s timeout)
- `POST /api/notifications/internal/notify` - Internal webhook (not public)

## 🔧 Configuration

### Supabase Vector DB Setup

Required table schema:

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Create documents table
create table documents (
  id bigserial primary key,
  vector vector(1536),  -- Match your embedding dimensions
  filename text,
  document_set text,
  content text,
  metadata jsonb,
  created_at timestamp default now()
);

-- Create vector similarity search function
create or replace function match_documents(
  query_embedding vector,
  match_threshold float,
  match_count int,
  filter_document_set text default null
)
returns table(
  content text,
  filename text,
  document_set text,
  similarity float,
  metadata jsonb
)
language plpgsql
as $$
begin
  return query
  select
    d.content,
    d.filename,
    d.document_set,
    1 - (d.vector <=> query_embedding) as similarity,
    d.metadata
  from documents d
  where
    (filter_document_set is null or d.document_set = filter_document_set)
    and 1 - (d.vector <=> query_embedding) > match_threshold
  order by d.vector <=> query_embedding
  limit match_count;
end;
$$;

-- Create index for performance
create index on documents using ivfflat (vector vector_cosine_ops)
  with (lists = 100);
```

### Azure Storage Setup

1. Create a storage account in Azure Portal
2. Create a container (e.g., "documents")
3. Get connection string from "Access keys"
4. Set `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME`

### Firebase Setup

1. Create a Firebase project
2. Enable Authentication (Email/Password, Google, etc.)
3. Download service account JSON (for backend)
4. Get web app config (for frontend)

## 🚢 Deployment

### Automated Deployments (Recommended)

All deployments are automated via GitHub Actions:

- **Push to `main`** → Deploy all apps automatically
- **Pull Request** → Run tests and preview deployments

**GitHub Actions Workflows:**
- `.github/workflows/vercel-backend-deploy.yml` - Deploy backend to Vercel
- `.github/workflows/vercel-frontend-deploy.yml` - Deploy frontend to Vercel
- `.github/workflows/docker-hub-deploy.yml` - Deploy worker to Docker Hub
- `.github/workflows/ci.yml` - Run tests and quality checks

**Required GitHub Secrets:**
```bash
VERCEL_TOKEN          # Vercel deployment token
VERCEL_ORG_ID         # Vercel organization ID
VERCEL_PROJECT_ID_BACKEND   # Backend project ID
VERCEL_PROJECT_ID_FRONTEND  # Frontend project ID
DOCKERHUB_USERNAME    # Docker Hub username
DOCKERHUB_TOKEN       # Docker Hub access token
```

### Manual Deployments

**Backend & Frontend (Vercel):**
```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy backend
cd apps/backend
vercel --prod

# Deploy frontend
cd apps/web
vercel --prod
```

**Worker (Docker):**
```bash
cd apps/worker
docker build -t your-org/langchain-worker:latest .
docker push your-org/langchain-worker:latest
```

### Production Environment Variables

Set environment variables in:
- **Vercel Dashboard** → Project Settings → Environment Variables
- **Docker runtime** → Container environment or secrets

## 🧪 Development Patterns

### Adding a New API Endpoint

1. Create handler in `apps/backend/api/<domain>/index.ts`
2. Add route rewrites in `apps/backend/vercel.json`
3. Define types in `apps/backend/lib/types.ts`
4. Add business logic in `apps/backend/lib/<service>.ts`
5. Update frontend API client in `apps/web/lib/api.ts`

### Adding a New Worker Task

1. Add handler class in `apps/worker/queue_worker.py`:
```python
class MyHandler:
    async def execute(self, payload: dict) -> dict:
        # Task implementation
        return {"status": "completed", "result": result}
```

2. Register handler in the `AsyncWorker` handlers dictionary
3. Submit tasks via Azure Queue from backend

### Working with Vector DB

```typescript
// Search documents
const results = await supabase.rpc('match_documents', {
  query_embedding: embedding,
  match_threshold: 0.7,
  match_count: 5,
  filter_document_set: 'my-docs'
});
```

## 📖 Project Structure

```
python-agents/
├── apps/
│   ├── backend/          # Node.js serverless functions
│   │   ├── api/          # API route handlers
│   │   │   ├── agent/
│   │   │   ├── documents/
│   │   │   ├── notifications/
│   │   │   └── summaries/
│   │   ├── lib/          # Shared services & utilities
│   │   │   ├── supabase.ts
│   │   │   ├── llm.ts
│   │   │   ├── database.ts
│   │   │   └── notifications.ts
│   │   └── vercel.json
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   ├── lib/          # Client utilities
│   │   └── public/
│   └── worker/           # Python async worker
│       ├── main.py           # Worker entry point
│       ├── queue_worker.py   # Queue polling and handlers
│       ├── config.py         # Configuration
│       └── services/         # Service modules
├── packages/             # Shared configs
│   ├── eslint-config/
│   └── typescript-config/
├── .github/
│   └── workflows/        # CI/CD pipelines
├── turbo.json           # Turborepo config
└── package.json         # Root workspace config
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Run `pre-commit run --all-files`
5. Commit with descriptive message
6. Push and create a Pull Request

All commits must pass:
- TypeScript type checking
- ESLint (backend & frontend)
- Prettier formatting
- Unit tests
- Python linting (Black, Ruff, Bandit)

## 📝 License

[Your License Here]

## 🙋 Support

- **Documentation**: Check `/docs` folder (coming soon)
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
