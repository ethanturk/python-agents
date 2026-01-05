import sqlite3
from datetime import datetime
from contextlib import contextmanager
from typing import Generator
import logging

logger = logging.getLogger(__name__)

# Local SQLite DB
DB_PATH = "agent.db"

def get_db_connection() -> sqlite3.Connection:
    """Get a database connection. Caller is responsible for closing."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager for database connections.
    Automatically handles connection and cursor cleanup.

    Usage:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
            conn.commit()
    """
    conn = None
    try:
        conn = get_db_connection()
        yield conn
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        if conn:
            conn.close()

def init_db() -> None:
    """Initialize the database schema."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE NOT NULL,
                summary_text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

def save_summary(filename: str, summary_text: str) -> None:
    """
    Save or update a document summary.

    Args:
        filename: The document filename
        summary_text: The summary content

    Raises:
        Exception: If database operation fails
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO summaries (filename, summary_text, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(filename) DO UPDATE SET
                summary_text = excluded.summary_text,
                created_at = excluded.created_at
        ''', (filename, summary_text, datetime.now()))
        conn.commit()

def get_summary(filename: str) -> dict | None:
    """
    Retrieve a summary by filename.

    Args:
        filename: The document filename

    Returns:
        Dictionary containing summary data or None if not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        summary = cursor.execute(
            'SELECT * FROM summaries WHERE filename = ?',
            (filename,)
        ).fetchone()

        if summary:
            return dict(summary)
        return None

def get_all_summaries() -> list[dict]:
    """
    Retrieve all summaries ordered by creation date.

    Returns:
        List of dictionaries containing summary metadata
    """
    with get_db() as conn:
        cursor = conn.cursor()
        summaries = cursor.execute(
            'SELECT filename, created_at FROM summaries ORDER BY created_at DESC'
        ).fetchall()
        return [dict(s) for s in summaries]
