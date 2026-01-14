"""
Worker entry point supporting dual execution modes:

1. Single-task mode (ACI): When TASK_DATA env var is set, process one task and exit
2. Polling mode (VPS/local): When TASK_DATA is not set, continuously poll Azure Queue

Usage:
    # Single-task mode (Azure Container Instances)
    TASK_DATA='{"task_type":"ingest","payload":{"filename":"doc.pdf"}}' python main.py

    # Polling mode (VPS or local development)
    CLIENT_ID=default python main.py
"""

import asyncio
import logging
import os
import sys

from queue_worker import main as run_polling_worker, process_single_task

logger = logging.getLogger(__name__)


async def main() -> int:
    """
    Main entry point with dual-mode support.

    Returns:
        Exit code: 0 for success, 1 for failure
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Check for single-task mode (ACI)
    task_data = os.environ.get("TASK_DATA")

    if task_data:
        # Single-task mode: process one task and exit
        logger.info("TASK_DATA detected - running in single-task mode")
        timeout = int(os.environ.get("WORKER_TASK_TIMEOUT", "1800"))
        return await process_single_task(task_data, timeout=timeout)
    else:
        # Polling mode: run continuous queue polling
        logger.info("No TASK_DATA - running in polling mode")
        await run_polling_worker()
        return 0


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)
