import asyncio
import logging
from collections.abc import Callable
from functools import wraps
from typing import Any

logger = logging.getLogger(__name__)


def handle_errors(
    error_message: str = "Operation failed",
    reraise: bool = True,
    return_value: Any = None,
    log_level: str = "error",
):
    """Decorator for consistent error handling.

    Args:
        error_message: Message prefix for logging errors
        reraise: Whether to re-raise the exception or return return_value
        return_value: Value to return if exception occurs and reraise=False
        log_level: Logging level ('error', 'warning', 'info', 'debug')

    Returns:
        Decorator function
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                log_func = getattr(logger, log_level, logger.error)
                log_func(f"{error_message}: {e}")
                if reraise:
                    raise
                return return_value

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                log_func = getattr(logger, log_level, logger.error)
                log_func(f"{error_message}: {e}")
                if reraise:
                    raise
                return return_value

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
