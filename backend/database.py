import sqlite3
from datetime import datetime

# Local SQLite DB
DB_PATH = "agent.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            summary_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_summary(filename: str, summary_text: str):
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO summaries (filename, summary_text, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(filename) DO UPDATE SET
                summary_text = excluded.summary_text,
                created_at = excluded.created_at
        ''', (filename, summary_text, datetime.now()))
        conn.commit()
    except Exception as e:
        print(f"DB Error saving summary: {e}")
        raise e
    finally:
        conn.close()

def get_summary(filename: str):
    conn = get_db_connection()
    c = conn.cursor()
    summary = c.execute('SELECT * FROM summaries WHERE filename = ?', (filename,)).fetchone()
    conn.close()
    if summary:
        return dict(summary)
    return None

def get_all_summaries():
    conn = get_db_connection()
    c = conn.cursor()
    summaries = c.execute('SELECT filename, created_at FROM summaries ORDER BY created_at DESC').fetchall()
    conn.close()
    return [dict(s) for s in summaries]
