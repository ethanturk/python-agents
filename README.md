# LangChain Agent System

This project demonstrates a scalable Client-Server architecture for LLM Agents with a React frontend and distributed background processing.

## Architecture

The system is composed of several independent services, each deployable via Docker:

1.  **Frontend**: React + Vite Web Application (UI).
2.  **Backend API**: FastAPI service managing agent execution and state.
3.  **Worker**: Celery worker for handling asynchronous tasks and document ingestion.
4.  **Infrastructure**:
    *   **RabbitMQ**: Message broker for task queues.
    *   **Qdrant**: Vector database for RAG (retrieval-augmented generation).
    *   **Flower**: Monitoring tool for Celery workers.

**Data Flow**: `Frontend -> Backend API -> RabbitMQ -> Worker -> LLM / Qdrant`

## Prerequisites

- Docker & Docker Compose
- OpenAI API Key (or compatible endpoint)

## Setup

1.  **Environment Variables**:
    Create a `.env` file in the project root. You can copy the example variables.
    
    ```properties
    OPENAI_API_KEY=sk-...
    OPENAI_API_BASE=https://api.openai.com/v1
    OPENAI_MODEL=gpt-4o
    
    # Optional Overrides
    # CELERY_BROKER_URL=amqp://guest:guest@rabbitmq:5672//
    # VITE_API_BASE=http://localhost:9999
    ```

## Running the Project

The project is split into separate Docker Compose files for flexible deployment.

### 1. Start Infrastructure & Backend
This launches RabbitMQ, Qdrant, Flower, and the main Backend API.

```bash
docker-compose -f docker-compose.yml up -d --build
```
*   **Backend API**: [http://localhost:9999/docs](http://localhost:9999/docs)
*   **Flower Dashboard**: [http://localhost:5555](http://localhost:5555)
*   **RabbitMQ Console**: [http://localhost:15672](http://localhost:15672) (guest/guest)

### 2. Start Worker
Launches the Celery worker to process background tasks and document ingestion.

```bash
docker-compose -f docker-compose.worker.yml up -d --build
```

### 3. Start Frontend
Launches the React Web UI.

```bash
docker-compose -f docker-compose.frontend.yml up -d --build
```
*   **Web UI**: [http://localhost:3000](http://localhost:3000)

## Development Notes

*   **Shared Volumes**: Data is persisted in docker volumes mapping to local directories (check `docker-compose.yml` volumes explicitly if you need to change storage paths).
*   **Networking**: Services communicate via the Docker network. The Frontend (running in browser) connects to the Backend URL configured via `VITE_API_BASE`.

## Testing

### Backend Tests
The backend uses `pytest` for unit testing. Tests cover API endpoints, agents, summarization logic, and async tasks.

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies (if running locally):
    ```bash
    pip install -r requirements.txt
    ```
3.  Run tests:
    ```bash
    pytest tests/
    ```

### Frontend Tests
The frontend uses `Vitest` and `React Testing Library`.

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run tests:
    ```bash
    npm test
    ```
