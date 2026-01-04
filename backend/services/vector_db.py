import os
import config
from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance, Filter, FieldCondition, MatchValue, HnswConfigDiff, PointStruct
from services.llm import get_embeddings_model
import uuid
import logging

logger = logging.getLogger(__name__)

class VectorDBService:
    def __init__(self):
        self.client = QdrantClient(host=os.getenv("QDRANT_HOST"), port=6333, timeout=60)
        self.collection_name = config.QDRANT_COLLECTION_NAME

    def ensure_collection_exists(self):
        """Checks if collection exists and creates it if not."""
        try:
            self.client.get_collection(self.collection_name)
        except Exception:
            try:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=config.OPENAI_EMBEDDING_DIMENSIONS, distance=Distance.COSINE),
                    hnsw_config=HnswConfigDiff(m=16, ef_construct=100)
                )
                logger.info(f"Created collection {self.collection_name}")
            except Exception as e:
                if "Conflict" in str(e) or "409" in str(e):
                    pass
                else:
                    raise e
        
        # Ensure payload indexes
        self._create_index("filename")
        self._create_index("document_set")

    def _create_index(self, field_name):
        try:
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name=field_name,
                field_schema="keyword"
            )
        except Exception:
            pass

    def search(self, query: str, limit: int = 10, document_set: str = None):
        """Search documents using embeddings."""
        embeddings = get_embeddings_model()
        try:
            vector = embeddings.embed_query(query)
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return []

        query_filter = None
        if document_set and document_set != "all":
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="document_set",
                        match=MatchValue(value=document_set)
                    )
                ]
            )

        try:
            # Use query_points_groups to group by filename
            response = self.client.query_points_groups(
                collection_name=self.collection_name,
                query=vector,
                group_by="filename",
                limit=limit,
                group_size=3,
                query_filter=query_filter
            )
            
            results = []
            if response and response.groups:
                for group in response.groups:
                    for hit in group.hits:
                        results.append({
                            "content": hit.payload.get("content"), 
                            "metadata": {
                                "filename": hit.payload.get("filename"), 
                                "document_set": hit.payload.get("document_set")
                            }
                        })
            return results
        except Exception as e:
            logger.error(f"Qdrant search failed: {e}")
            return []

    def list_documents(self, limit=100, offset=None):
        """List all documents (scroll)."""
        all_points = []
        while True:
            result, offset = self.client.scroll(
                collection_name=self.collection_name,
                limit=limit,
                with_payload=True,
                with_vectors=False,
                offset=offset
            )
            all_points.extend(result)
            if offset is None:
                break
        return all_points

    def upsert_vectors(self, points: list[PointStruct]):
        self.client.upsert(collection_name=self.collection_name, points=points)

    def delete_document(self, filename: str, document_set: str = None):
         must_conditions = [FieldCondition(key="filename", match=MatchValue(value=filename))]
         
         if document_set and document_set != "all":
             must_conditions.append(FieldCondition(key="document_set", match=MatchValue(value=document_set)))

         self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=must_conditions
            )
        )

# Global Instance
db_service = VectorDBService()
