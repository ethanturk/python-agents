import asyncio
from queue_worker import main as run_worker


if __name__ == "__main__":
    asyncio.run(run_worker())
