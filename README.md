# LangChain Agent Client-Server

This project demonstrates a Client-Server architecture for LLM Agents:
1.  **Backend API**: FastAPI service managing agent execution.
2.  **Frontend CLI**: a Python CLI tool interacting with the API.
3.  **Worker**: Celery worker for asynchronous task orchestration.

## Architecture

- **Sync Agent**: CLI -> API -> LLM -> API -> CLI
- **Async Agent**: CLI -> API -> Celery (RabbitMQ) -> Worker -> LLM -> API -> CLI

## Prerequisites
- Python 3.9+
- OpenAI API Key

## Setup
1.  Create and ACTIVATE a virtual environment (Required):
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Create a `.env` file (or `config.py`) with your OpenAI API Key.

## Running the Project

You will need **three** separate terminal windows. Ensure the virtual environment is activated in ALL of them.

### 1. Start Celery Worker
Handles asynchronous tasks.
```bash
# Terminal 1
source venv/bin/activate
celery -A async_tasks worker --loglevel=info
```

### 2. Start Backend API
Hosts the agent logic.
```bash
# Terminal 2
source venv/bin/activate
uvicorn backend_app:app --reload
```
The API will be available at `http://localhost:8000`.

### 3. Run Client CLI
Interactive frontend for the user.
```bash
# Terminal 3
source venv/bin/activate
python frontend_cli.py
```
Follow the on-screen prompts to use Sync or Async agents.

## Standalone Mode (Legacy)
To run the agents directly without the Client-Server setup:
```bash
python main.py
```
