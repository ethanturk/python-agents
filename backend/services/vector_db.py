import os
import json
import logging
import uuid
import re
from typing import List, Dict, Any, Optional

import asyncpg
from pgvector.asyncpg import register_vector
import config
from services.llm import get_embeddings_model

logger = logging.getLogger(__name__)

class VectorDBService:
    def __init__(self):
        self.db_url = config.DATABASE_CONN_STRING
        self.table_name = config.VECTOR_TABLE_NAME or 'documents'
        self.pool = None
        self._schema_verified = False
        self._validate_table_name()

    def _validate_table_name(self):
        """Ensure table name is safe to use in SQL strings."""
        if not re.match(r'^[a-zA-Z0-9_]+$', self.table_name):
            raise ValueError(f"Invalid table name: {self.table_name}")

    async def get_pool(self):
        """Get or create the connection pool."""
        if not self.db_url:
            logger.warning("DATABASE_CONN_STRING not set.")
            return None
            
        if self.pool is None:
            try:
                # Debug logging to identify what host we are failing to connect to
                if self.db_url:
                    from urllib.parse import urlparse
                    try:
                        parsed = urlparse(self.db_url)
                        logger.info(f"Attempting to connect to DB at host: {parsed.hostname}, port: {parsed.port}")
                    except Exception:
                         logger.info(f"Attempting to connect to DB (failed to parse URL for logging)")

                self.pool = await asyncpg.create_pool(
                    self.db_url,
                    min_size=1,
                    max_size=10,
                    init=self._init_connection
                )
            except Exception as e:
                logger.error(f"Failed to create connection pool: {e}")
                return None
        return self.pool

    async def _init_connection(self, conn):
        """Initialize connection with pgvector type registration."""
        await register_vector(conn)

    async def ensure_collection_exists(self):
        """Checks if table exists and creates it and the extension if not."""
        pool = await self.get_pool()
        if not pool:
            return

        try:
            async with pool.acquire() as conn:
                # Enable pgvector extension
                await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                
                # Create table
                dims = config.OPENAI_EMBEDDING_DIMENSIONS
                # Table name is validated in __init__
                await conn.execute(f"""
                    CREATE TABLE IF NOT EXISTS {self.table_name} (
                        id UUID PRIMARY KEY,
                        vector VECTOR({dims}),
                        filename TEXT,
                        document_set TEXT,
                        content TEXT,
                        metadata JSONB,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                """)
                
                # Create indexes
                await conn.execute(f"""
                    CREATE INDEX IF NOT EXISTS {self.table_name}_vector_idx 
                    ON {self.table_name} 
                    USING hnsw (vector vector_cosine_ops);
                """)
                await conn.execute(f"CREATE INDEX IF NOT EXISTS idx_filename ON {self.table_name} (filename);")
                await conn.execute(f"CREATE INDEX IF NOT EXISTS idx_document_set ON {self.table_name} (document_set);")
                
            logger.info(f"Ensured table {self.table_name} exists with pgvector extension.")
            self._schema_verified = True
        except Exception as e:
            logger.error(f"Failed to ensure vector table exists: {e}")
            raise e

    async def search(self, query: str, limit: int = 10, document_set: str = None) -> List[Dict[str, Any]]:
        """Search documents using embeddings."""
        pool = await self.get_pool()
        if not pool:
            return []

        embeddings = get_embeddings_model()
        try:
            query_vector = embeddings.embed_query(query)
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return []

        try:
            async with pool.acquire() as conn:
                sql_query = f"""
                    SELECT content, filename, document_set, metadata, 
                           1 - (vector <=> $1) as similarity
                    FROM {self.table_name}
                """
                params = [query_vector]
                
                if document_set and document_set != "all":
                    sql_query += " WHERE document_set = $2"
                    params.append(document_set)
                    # Next param index is dependent on previous
                    idx = 3 # if doc_set present, limit is $3
                else:
                    idx = 2 # if not, limit is $2
                
                sql_query += f" ORDER BY vector <=> $1 LIMIT ${idx-1}"
                params.append(limit)
                
                # asyncpg uses $n for params
                rows = await conn.fetch(sql_query, *params)
                
                results = []
                for row in rows:
                    results.append({
                        "content": row['content'],
                        "metadata": {
                            "filename": row['filename'],
                            "document_set": row['document_set'],
                            **(json.loads(row['metadata']) if row['metadata'] else {})
                        },
                        "score": float(row['similarity'])
                    })
                    
            return results
        except Exception as e:
            logger.error(f"Postgres vector search failed: {e}")
            return []

    async def upsert_vectors(self, points: List[Dict[str, Any]]):
        """Upsert vectors."""
        # Lazy check for schema initialization
        if not self._schema_verified:
            await self.ensure_collection_exists()

        pool = await self.get_pool()
        if not pool or not points:
            return

        try:
            async with pool.acquire() as conn:
                # Prepare data for executemany
                records = []
                for point in points:
                    p_id = point.get('id') or str(uuid.uuid4())
                    vector = point.get('vector')
                    payload = point.get('payload', {})
                    filename = payload.get('filename')
                    content = payload.get('content')
                    doc_set = payload.get('document_set')
                    
                    metadata = {k: v for k, v in payload.items() if k not in ['filename', 'content', 'document_set']}
                    records.append((p_id, vector, filename, doc_set, content, json.dumps(metadata)))

                # Upsert query
                query = f"""
                    INSERT INTO {self.table_name} (id, vector, filename, document_set, content, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO UPDATE SET
                        vector = EXCLUDED.vector,
                        filename = EXCLUDED.filename,
                        document_set = EXCLUDED.document_set,
                        content = EXCLUDED.content,
                        metadata = EXCLUDED.metadata;
                """
                await conn.executemany(query, records)
                    
        except Exception as e:
            logger.error(f"Upsert failed: {e}")
            raise e

    async def delete_document(self, filename: str, document_set: str = None):
        pool = await self.get_pool()
        if not pool:
            return

        try:
            async with pool.acquire() as conn:
                query = f"DELETE FROM {self.table_name} WHERE filename = $1"
                params = [filename]
                
                if document_set and document_set != "all":
                    query += " AND document_set = $2"
                    params.append(document_set)
                    
                await conn.execute(query, *params)
                logger.info(f"Deleted documents for filename: {filename}")
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            raise e

    async def list_documents(self, limit=100, offset=0):
        pool = await self.get_pool()
        if not pool:
             return []

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(f"""
                    SELECT id, content, filename, document_set, metadata 
                    FROM {self.table_name} 
                    LIMIT $1 OFFSET $2
                """, limit, offset)
                
                results = []
                for row in rows:
                     results.append({
                         "id": str(row['id']),
                         "payload": {
                             "content": row['content'],
                             "filename": row['filename'],
                             "document_set": row['document_set'],
                             **(json.loads(row['metadata']) if row['metadata'] else {})
                         }
                     })
                return results
        except Exception as e:
            logger.error(f"List documents failed: {e}")
            return []

    async def close(self):
        if self.pool:
            await self.pool.close()
            self.pool = None

# Global Instance
db_service = VectorDBService()
