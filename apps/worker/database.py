import logging
from datetime import datetime
from services.supabase_service import supabase_service

logger = logging.getLogger(__name__)


def init_db() -> None:
    """
    Verify Supabase connection on startup.
    Note: Tables should be created by running scripts/init_db.sql in Supabase SQL Editor.
    """
    try:
        if not supabase_service.client:
            logger.warning(
                "Supabase client not initialized. Set SUPABASE_URL and SUPABASE_KEY environment variables."
            )
            return

        if not supabase_service.is_available():
            logger.warning("Supabase service is not available")
            return

        logger.info(
            "Supabase connection verified. Make sure to run scripts/init_db.sql to create tables."
        )
    except Exception as e:
        logger.error(f"Failed to verify Supabase connection: {e}")


def save_summary(filename: str, summary_text: str) -> None:
    """
    Save or update a document summary in Supabase.
    Uses upsert to handle both insert and update cases.
    """
    try:
        if not supabase_service.client:
            logger.warning("Supabase client not initialized, cannot save summary")
            return

        response = (
            supabase_service.client.table("summaries")
            .upsert(
                {
                    "filename": filename,
                    "summary_text": summary_text,
                    "created_at": datetime.now().isoformat(),
                }
            )
            .execute()
        )

        if response.data:
            logger.info(f"Summary saved for {filename}")
        else:
            logger.warning(f"Empty response saving summary for {filename}")
    except Exception as e:
        logger.error(f"Failed to save summary for {filename}: {e}")
        raise


def get_summary(filename: str) -> dict | None:
    """
    Retrieve a summary by filename from Supabase.
    """
    try:
        if not supabase_service.client:
            logger.warning("Supabase client not initialized, cannot retrieve summary")
            return None

        response = (
            supabase_service.client.table("summaries")
            .select("*")
            .eq("filename", filename)
            .execute()
        )

        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Failed to get summary for {filename}: {e}")
        return None


def get_all_summaries() -> list[dict]:
    """
    Retrieve all summaries ordered by creation date from Supabase.
    """
    try:
        if not supabase_service.client:
            logger.warning("Supabase client not initialized, cannot retrieve summaries")
            return []

        response = (
            supabase_service.client.table("summaries")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )

        if response.data:
            logger.info(f"Retrieved {len(response.data)} summaries")
            return response.data
        return []
    except Exception as e:
        logger.error(f"Failed to get all summaries: {e}")
        return []
