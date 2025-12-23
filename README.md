# LangChain Agent Sample

This project demonstrates two types of agents:
1.  **Synchronous Agent**: Direct user-to-LLM interaction.
2.  **Asynchronous Agent**: Orchestrated via Celery with a multi-step workflow.

## Prerequisites
- Python 3.9+
- RabbitMQ running at `192.168.5.200` (Default port 5672)
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
3.  Set your API key in `config.py` or export it.

## Running the Project

### Start Celery Worker
In a separate terminal window (**Activate venv first!**):
```bash
source venv/bin/activate
celery -A async_tasks worker --loglevel=info
```

### Run the App
```bash
source venv/bin/activate
python main.py
```
Select option 1 for Sync, or 2 for Async.
