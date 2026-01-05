import logging
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
        self._init_client()

    def _init_client(self):
        if self.supabase_url and self.supabase_key:
            try:
                self.client = create_client(self.supabase_url, self.supabase_key)
                logger.info("Initialized Supabase REST client.")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.client = None
        else:
            logger.warning("SUPABASE_URL or SUPABASE_KEY not set.")

    def is_available(self) -> bool:
        return self.client is not None

    def rpc(self, function_name: str, params: Dict[str, Any]) -> Any:
        """Execute a Postgres RPC function."""
        if not self.client:
            logger.error("Supabase client not initialized.")
            return None
        
        try:
            return self.client.rpc(function_name, params).execute()
        except Exception as e:
            logger.error(f"RPC {function_name} failed: {e}")
            raise e

    def upsert(self, table: str, data: List[Dict[str, Any]]) -> Any:
        """Upsert records into a table."""
        if not self.client:
            logger.error("Supabase client not initialized.")
            return None

        try:
            return self.client.table(table).upsert(data).execute()
        except Exception as e:
            logger.error(f"Upsert to {table} failed: {e}")
            raise e

    def delete(self, table: str, filters: Dict[str, Any]) -> Any:
        """
        Delete records from a table based on simple equality filters.
        filters: dict of col_name -> value
        """
        if not self.client:
            return None

        try:
            query = self.client.table(table).delete()
            for col, val in filters.items():
                query = query.eq(col, val)
            return query.execute()
        except Exception as e:
            logger.error(f"Delete from {table} failed: {e}")
            raise e

    def select(self, table: str, columns: str = "*", range_start: int = None, range_end: int = None) -> Any:
        """Select records from a table."""
        if not self.client:
            return None

        try:
            query = self.client.table(table).select(columns)
            if range_start is not None and range_end is not None:
                query = query.range(range_start, range_end)
            return query.execute()
        except Exception as e:
            logger.error(f"Select from {table} failed: {e}")
            raise e

# Global instance
supabase_service = SupabaseService()
