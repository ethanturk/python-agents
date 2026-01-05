import logging
import threading
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
import config

logger = logging.getLogger(__name__)

class SupabaseService:
    """
    Service to handle direct interactions with Supabase REST API.
    Wraps the supabase-py client.
    """
    def __init__(self):
        self.supabase_url = config.SUPABASE_URL
        self.supabase_key = config.SUPABASE_KEY
        self.client: Optional[Client] = None
        self._lock = threading.Lock()  # Thread safety for initialization
        self._init_client()

    def _init_client(self):
        """Initialize Supabase client with thread safety."""
        if self.supabase_url and self.supabase_key:
            with self._lock:
                # Double-check pattern to avoid race conditions
                if self.client is None:
                    try:
                        self.client = create_client(self.supabase_url, self.supabase_key)
                        logger.info("Initialized Supabase REST client.")
                    except Exception as e:
                        logger.error(f"Failed to initialize Supabase client: {e}")
                        self.client = None
        else:
            logger.warning("SUPABASE_URL or SUPABASE_KEY not set.")

    def _ensure_client(self) -> Client:
        """
        Ensure client is initialized and return it.

        Returns:
            Client: The Supabase client

        Raises:
            RuntimeError: If client is not initialized
        """
        if not self.client:
            raise RuntimeError(
                "Supabase client not initialized. "
                "Check SUPABASE_URL and SUPABASE_KEY environment variables."
            )
        return self.client

    def is_available(self) -> bool:
        return self.client is not None

    def rpc(self, function_name: str, params: Dict[str, Any]) -> Any:
        """
        Execute a Postgres RPC function.

        Args:
            function_name: Name of the RPC function
            params: Parameters to pass to the function

        Returns:
            Response from the RPC call

        Raises:
            RuntimeError: If client is not initialized
            Exception: If RPC call fails
        """
        try:
            client = self._ensure_client()
            return client.rpc(function_name, params).execute()
        except Exception as e:
            logger.error(f"RPC {function_name} failed: {e}")
            raise

    def upsert(self, table: str, data: List[Dict[str, Any]]) -> Any:
        """
        Upsert records into a table.

        Args:
            table: Table name
            data: List of records to upsert

        Returns:
            Response from the upsert operation

        Raises:
            RuntimeError: If client is not initialized
            Exception: If upsert fails
        """
        try:
            client = self._ensure_client()
            return client.table(table).upsert(data).execute()
        except Exception as e:
            logger.error(f"Upsert to {table} failed: {e}")
            raise

    def delete(self, table: str, filters: Dict[str, Any]) -> Any:
        """
        Delete records from a table based on simple equality filters.

        Args:
            table: Table name
            filters: Dictionary of column_name -> value for filtering

        Returns:
            Response from the delete operation

        Raises:
            RuntimeError: If client is not initialized
            Exception: If delete fails
        """
        try:
            client = self._ensure_client()
            query = client.table(table).delete()
            for col, val in filters.items():
                query = query.eq(col, val)
            return query.execute()
        except Exception as e:
            logger.error(f"Delete from {table} failed: {e}")
            raise

    def select(self, table: str, columns: str = "*", range_start: int = None, range_end: int = None) -> Any:
        """
        Select records from a table.

        Args:
            table: Table name
            columns: Columns to select (default: "*")
            range_start: Starting index for pagination
            range_end: Ending index for pagination

        Returns:
            Response from the select operation

        Raises:
            RuntimeError: If client is not initialized
            Exception: If select fails
        """
        try:
            client = self._ensure_client()
            query = client.table(table).select(columns)
            if range_start is not None and range_end is not None:
                query = query.range(range_start, range_end)
            return query.execute()
        except Exception as e:
            logger.error(f"Select from {table} failed: {e}")
            raise

    def close(self):
        """
        Close the Supabase client and cleanup resources.
        The supabase-py client uses httpx internally, which should be closed.
        """
        if self.client:
            try:
                # The supabase client has a postgrest_client which has an httpx session
                if hasattr(self.client, 'postgrest') and hasattr(self.client.postgrest, 'session'):
                    # Close the httpx client session
                    import asyncio
                    try:
                        # Try to close async session if running in async context
                        asyncio.get_running_loop()
                        # We're in async context, but session.close() is sync
                        self.client.postgrest.session.close()
                    except RuntimeError:
                        # No running event loop, just close synchronously
                        self.client.postgrest.session.close()
                logger.info("Closed Supabase client connections.")
            except Exception as e:
                logger.warning(f"Error closing Supabase client: {e}")
            finally:
                self.client = None

# Global instance
supabase_service = SupabaseService()
