from abc import ABC, abstractmethod
from typing import Any


class VectorReader(ABC):
    """Interface for reading/searching vector data."""

    @abstractmethod
    async def search(
        self, query: str, limit: int = 10, document_set: str = None
    ) -> list[dict[str, Any]]:
        """Search for documents similar to query."""
        pass

    @abstractmethod
    async def list_documents(self, limit=1000, offset=0) -> list[Any]:
        """List all documents."""
        pass


class VectorWriter(ABC):
    """Interface for writing/updating vector data."""

    @abstractmethod
    async def upsert_vectors(self, points: list[dict[str, Any]]) -> None:
        """Insert or update document vectors."""
        pass


class VectorDeleter(ABC):
    """Interface for deleting vector data."""

    @abstractmethod
    async def delete_document(self, filename: str, document_set: str = None) -> None:
        """Delete a document by filename."""
        pass


class DocumentMetadataReader(ABC):
    """Interface for reading document metadata."""

    @abstractmethod
    async def get_distinct_document_sets(self) -> list[str]:
        """Get all distinct document sets."""
        pass

    @abstractmethod
    async def get_distinct_filenames(self) -> list[dict[str, Any]]:
        """Get distinct filenames with metadata."""
        pass
