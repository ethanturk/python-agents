from abc import ABC, abstractmethod
from docling.document_converter import DocumentConverter


class DocumentPipelineStrategy(ABC):
    """Abstract strategy for document processing pipelines."""

    @abstractmethod
    def get_converter(self) -> DocumentConverter:
        """Get the configured converter for this pipeline."""
        pass

    @abstractmethod
    def get_pipeline_name(self) -> str:
        """Get the name identifier for this pipeline."""
        pass

    @abstractmethod
    def cleanup_backend(self, doc_result) -> None:
        """Cleanup resources after conversion."""
        pass


class StandardPipelineStrategy(DocumentPipelineStrategy):
    """Standard pipeline without OCR, with table structure."""

    def __init__(self):
        self._converter = None

    def get_converter(self) -> DocumentConverter:
        if self._converter is None:
            from services.docling_utils import DoclingConverterFactory

            self._converter = DoclingConverterFactory.create_standard_converter()
        return self._converter

    def get_pipeline_name(self) -> str:
        return "standard"

    def cleanup_backend(self, doc_result) -> None:
        if hasattr(doc_result.input, "_backend") and doc_result.input._backend:
            try:
                doc_result.input._backend.unload()
            except:
                pass


class VLMPipelineStrategy(DocumentPipelineStrategy):
    """Vision-Language Model pipeline for enhanced document understanding."""

    def __init__(self):
        self._converter = None

    def get_converter(self) -> DocumentConverter:
        if self._converter is None:
            from services.docling_utils import DoclingConverterFactory

            self._converter = DoclingConverterFactory.create_vlm_converter()
        return self._converter

    def get_pipeline_name(self) -> str:
        return "vlm"

    def cleanup_backend(self, doc_result) -> None:
        if hasattr(doc_result.input, "_backend") and doc_result.input._backend:
            try:
                doc_result.input._backend.unload()
            except:
                pass


class PipelineFactory:
    """Factory for creating pipeline strategies."""

    @staticmethod
    def create_pipeline(use_vlm: bool = False) -> DocumentPipelineStrategy:
        """Create appropriate pipeline based on configuration."""
        if use_vlm:
            return VLMPipelineStrategy()
        return StandardPipelineStrategy()
