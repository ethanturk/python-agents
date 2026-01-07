"""
Refactored SupabaseService - EXAMPLE ONLY, NOT FOR PRODUCTION USE
Demonstrates fixes for DRY, SOLID, and connection pooling issues.
"""

import logging
from contextlib import asynccontextmanager
from typing import Any, Optional, Protocol

from supabase import Client, create_client

logger = logging.getLogger(__name__)


class SupabaseConfig(Protocol):
    """Protocol for Supabase configuration (Dependency Inversion)."""

    url: str
    key: str


class SupabaseClientFactory:
    """Factory for creating Supabase clients with retry logic."""

    @staticmethod
    def create(config: SupabaseConfig, max_retries: int = 3) -> Optional[Client]:
        """Create a Supabase client with retry logic."""
        if not config.url or not config.key:
            logger.warning("SUPABASE_URL or SUPABASE_KEY not set.")
            return None

        for attempt in range(max_retries):
            try:
                client = create_client(config.url, config.key)
                logger.info(f"Initialized Supabase REST client (attempt {attempt + 1})")
                return client
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client (attempt {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    return None
        return None


class SupabaseService:
    """
    Service to handle direct interactions with Supabase REST API.

    Improvements:
    - Dependency injection for configuration
    - Lazy client initialization
    - DRY client validation
    - Consistent error handling
    - Resource cleanup support
    """

    def __init__(self, config: SupabaseConfig, client: Optional[Client] = None):
        """
        Initialize Supabase service.

        Args:
            config: Configuration object with url and key
            client: Optional pre-initialized client (for testing)
        """
        self.config = config
        self._client: Optional[Client] = client
        self._initialized = False

    @property
    def client(self) -> Optional[Client]:
        """Lazy-initialized Supabase client."""
        if self._client is None and not self._initialized:
            self._client = SupabaseClientFactory.create(self.config)
            self._initialized = True
        return self._client

    def _ensure_client(self) -> Client:
        """Ensure client is initialized, raise if not."""
        if self.client is None:
            raise RuntimeError(
                "Supabase client not initialized. "
                "Check SUPABASE_URL and SUPABASE_KEY configuration."
            )
        return self.client

    def is_available(self) -> bool:
        """Check if Supabase client is available."""
        return self.client is not None

    def rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        """
        Execute a Postgres RPC function.

        Args:
            function_name: Name of the RPC function
            params: Function parameters

        Returns:
            RPC execution result

        Raises:
            RuntimeError: If client not initialized
            Exception: If RPC execution fails
        """
        try:
            return self._ensure_client().rpc(function_name, params).execute()
        except Exception as e:
            logger.error(f"RPC {function_name} failed: {e}")
            raise

    def upsert(self, table: str, data: list[dict[str, Any]]) -> Any:
        """
        Upsert records into a table.

        Args:
            table: Table name
            data: List of records to upsert

        Returns:
            Upsert result

        Raises:
            RuntimeError: If client not initialized
            Exception: If upsert fails
        """
        try:
            return self._ensure_client().table(table).upsert(data).execute()
        except Exception as e:
            logger.error(f"Upsert to {table} failed: {e}")
            raise

    def delete(self, table: str, filters: dict[str, Any]) -> Any:
        """
        Delete records from a table based on equality filters.

        Args:
            table: Table name
            filters: Dictionary of column_name -> value for filtering

        Returns:
            Delete result

        Raises:
            RuntimeError: If client not initialized
            Exception: If delete fails
        """
        try:
            query = self._ensure_client().table(table).delete()
            for col, val in filters.items():
                query = query.eq(col, val)
            return query.execute()
        except Exception as e:
            logger.error(f"Delete from {table} failed: {e}")
            raise

    def select(
        self,
        table: str,
        columns: str = "*",
        range_start: Optional[int] = None,
        range_end: Optional[int] = None,
    ) -> Any:
        """
        Select records from a table.

        Args:
            table: Table name
            columns: Columns to select (default: all)
            range_start: Optional pagination start
            range_end: Optional pagination end

        Returns:
            Select result

        Raises:
            RuntimeError: If client not initialized
            Exception: If select fails
        """
        try:
            query = self._ensure_client().table(table).select(columns)
            if range_start is not None and range_end is not None:
                query = query.range(range_start, range_end)
            return query.execute()
        except Exception as e:
            logger.error(f"Select from {table} failed: {e}")
            raise

    def query_builder(self, table: str) -> Any:
        """
        Get a query builder for complex operations.

        Args:
            table: Table name

        Returns:
            Supabase query builder for the table

        Raises:
            RuntimeError: If client not initialized
        """
        return self._ensure_client().table(table)

    async def close(self):
        """Close the underlying HTTP client and cleanup resources."""
        if self._client:
            # The supabase-py client uses httpx internally
            # Check if it exposes a close method
            try:
                if hasattr(self._client, "close"):
                    await self._client.close()
                # Note: Current supabase-py may not expose close()
                # This is a limitation of the library
                logger.info("Closed Supabase client")
            except Exception as e:
                logger.warning(f"Error closing Supabase client: {e}")
            finally:
                self._client = None
                self._initialized = False


# Example configuration class
class EnvSupabaseConfig:
    """Configuration loaded from environment variables."""

    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key


# Factory function for creating service with environment config
def create_supabase_service(url: str, key: str) -> SupabaseService:
    """
    Factory function to create SupabaseService from configuration.

    Args:
        url: Supabase project URL
        key: Supabase API key

    Returns:
        Configured SupabaseService instance
    """
    config = EnvSupabaseConfig(url, key)
    return SupabaseService(config)


# Context manager for proper resource cleanup
@asynccontextmanager
async def supabase_service_context(config: SupabaseConfig):
    """
    Async context manager for SupabaseService lifecycle.

    Example:
        async with supabase_service_context(config) as service:
            result = service.rpc('my_function', {})
    """
    service = SupabaseService(config)
    try:
        yield service
    finally:
        await service.close()
