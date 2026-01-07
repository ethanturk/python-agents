from docling.datamodel.base_models import DocumentStream
from langchain_text_splitters import RecursiveCharacterTextSplitter
from services.llm import get_embeddings_model, LLMService
from services.vector_db import db_service
from services.ingestion_pipeline import PipelineFactory
from utils.file_conversion import FileConversionUtils

import uuid
import logging
import gc
from io import BytesIO
from pathlib import Path

logger = logging.getLogger(__name__)


class IngestionService:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        self._standard_pipeline = None
        self._vlm_pipeline = None

    def _get_pipeline(self, use_vlm: bool):
        """Get the appropriate pipeline strategy."""
        if use_vlm:
            if self._vlm_pipeline is None:
                self._vlm_pipeline = PipelineFactory.create_pipeline(use_vlm=True)
            return self._vlm_pipeline
        else:
            if self._standard_pipeline is None:
                self._standard_pipeline = PipelineFactory.create_pipeline(use_vlm=False)
            return self._standard_pipeline

    async def _process_content_flow(
        self, filename, content=None, filepath=None, document_set="all", use_vlm=False
    ):
        """Internal shared flow for processing content."""
        pipeline = self._get_pipeline(use_vlm)
        pipeline_type = pipeline.get_pipeline_name()
        logger.info(f"Processing file: {filename} (Pipeline: {pipeline_type})")

        temp_file_to_cleanup = None
        markdown_content = ""

        try:
            input_source = filepath or (BytesIO(content) if content else None)

            if input_source is None:
                return "No content or filepath provided."

            source, temp_file_to_cleanup = FileConversionUtils.prepare_source_for_conversion(
                input_source, filename
            )

            if not source:
                return f"Failed to prepare source for {filename}"

            elif content and not FileConversionUtils.is_xls_file(None, filename):
                source = DocumentStream(name=filename, stream=BytesIO(content))

            converter = pipeline.get_converter()
            doc_result = converter.convert(source)
            markdown_content = doc_result.document.export_to_markdown()

            pipeline.cleanup_backend(doc_result)
            FileConversionUtils.cleanup_temp_file(temp_file_to_cleanup)

        except Exception as e:
            FileConversionUtils.cleanup_temp_file(temp_file_to_cleanup)
            return f"Conversion failed for {filename}: {e}"

        # 2. Chunking
        chunks = self.splitter.split_text(markdown_content)
        chunks = [str(c) for c in chunks if c and str(c).strip()]

        if not chunks:
            return f"Skipped {filename}: No content extracted."

        # 3. Embedding
        vectors = []
        embeddings_model = LLMService.get_embeddings()

        try:
            # Prefer async embedding if available
            if hasattr(embeddings_model, "aembed_documents"):
                vectors = await embeddings_model.aembed_documents(chunks)
            else:
                vectors = embeddings_model.embed_documents(chunks)
        except Exception as e:
            return f"Embedding failed for {filename}: {e}"

        # 4. Upsert (Indexing)
        points = []
        for i, chunk in enumerate(chunks):
            points.append(
                {
                    "id": str(uuid.uuid4()),
                    "vector": vectors[i],
                    "payload": {
                        "filename": filename,
                        "content": chunk,
                        "document_set": document_set,
                        "pipeline": pipeline_type,
                    },
                }
            )

        batch_size = 64
        for i in range(0, len(points), batch_size):
            try:
                batch_points = points[i : i + batch_size]
                await db_service.upsert_vectors(batch_points)  # await async method
            except Exception as e:
                return f"Upsert failed for batch {i}: {e}"

        # Explicit GC still helpful for heavyweight VLM artifacts
        gc.collect()
        return f"Indexed {filename} ({pipeline_type}): {len(chunks)} chunks."

    async def process_file(self, filename, content=None, filepath=None, document_set="all"):
        """Process a single file: Convert -> Chunk -> Embed -> Index."""
        return await self._process_content_flow(
            filename, content, filepath, document_set, use_vlm=False
        )

    async def process_file_vlm(self, filename, content=None, filepath=None, document_set="all"):
        """Process a single file using VLM pipeline."""
        return await self._process_content_flow(
            filename, content, filepath, document_set, use_vlm=True
        )


ingestion_service = IngestionService()
