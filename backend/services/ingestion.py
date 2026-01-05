from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat, DocumentStream
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.pipeline.vlm_pipeline import VlmPipeline
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from langchain_text_splitters import RecursiveCharacterTextSplitter
from services.llm import get_embeddings_model, LLMService # ensure imports match existing patterns
from services.vector_db import db_service

import pandas as pd
import tempfile
import os
import uuid
import time
import logging
import gc
from io import BytesIO
from pathlib import Path
import config
from utils.file_conversion import FileConversionUtils

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        self.converter = self._get_docling_converter()
        self._vlm_converter_instance = None

    def _get_docling_converter(self):
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False
        pipeline_options.do_table_structure = True
        pipeline_options.table_structure_options.do_cell_matching = False
        pipeline_options.generate_page_images = False
        pipeline_options.generate_picture_images = False
        
        return DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options,
                    backend=PyPdfiumDocumentBackend
                )
            }
        )

    @property
    def _vlm_converter(self):
        """Singleton accessor for VLM converter to avoid heavy re-initialization."""
        if self._vlm_converter_instance is None:
            logger.info("Initializing Singleton VLM Converter...")
            self._vlm_converter_instance = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(
                        pipeline_cls=VlmPipeline,
                    )
                }
            )
        return self._vlm_converter_instance

    async def _process_content_flow(self, filename, content=None, filepath=None, document_set="all", use_vlm=False):
        """Internal shared flow for processing content."""
        pipeline_type = "vlm" if use_vlm else "standard"
        logger.info(f"Processing file: {filename} (Pipeline: {pipeline_type})")
        
        # 1. Convert to Markdown
        chunk_source_failed = False
        markdown_content = ""
        
        try:
            source = None
            temp_file_to_cleanup = None
            
            # Handle .xls -> .xlsx conversion (Standard only, VLM unlikely to take XLS unless converted to PDF/Image, but keeping valid logic)
            if filename.lower().endswith('.xls') and not use_vlm:
                if content:
                    temp_xlsx = FileConversionUtils.convert_xls_to_xlsx(BytesIO(content), filename)
                else:
                    temp_xlsx = FileConversionUtils.convert_xls_to_xlsx(filepath, filename)
                
                if not temp_xlsx:
                    return f"Failed to convert .xls {filename}"
                
                temp_file_to_cleanup = temp_xlsx
                source = temp_xlsx
            
            elif content:
                 source = DocumentStream(name=filename, stream=BytesIO(content))
            elif filepath:
                 source = filepath
            else:
                 return "No content or filepath provided."

            # Select converter
            converter = self._vlm_converter if use_vlm else self.converter
            
            # Convert
            # Docling conversion is sync (CPU bound). In a real async app, we might want to run this in a threadpool.
            # strict async: loop.run_in_executor(...)
            # For now, keeping it sync blocking in the worker (assuming worker is threaded or separate process)
            doc_result = converter.convert(source)
            markdown_content = doc_result.document.export_to_markdown()
            
            # Cleanup backend resources
            if hasattr(doc_result.input, '_backend') and doc_result.input._backend:
                try:
                    doc_result.input._backend.unload()
                except:
                    pass
            
            # Cleanup temp file
            FileConversionUtils.cleanup_temp_file(temp_file_to_cleanup)

        except Exception as e:
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
            if hasattr(embeddings_model, 'aembed_documents'):
                vectors = await embeddings_model.aembed_documents(chunks)
            else:
                vectors = embeddings_model.embed_documents(chunks)
        except Exception as e:
            return f"Embedding failed for {filename}: {e}"

        # 4. Upsert (Indexing)
        points = []
        for i, chunk in enumerate(chunks):
            points.append({
                "id": str(uuid.uuid4()),
                "vector": vectors[i],
                "payload": {
                    "filename": filename, 
                    "content": chunk, 
                    "document_set": document_set,
                    "pipeline": pipeline_type
                }
            })
        
        batch_size = 64
        for i in range(0, len(points), batch_size):
            try:
                batch_points = points[i : i + batch_size]
                await db_service.upsert_vectors(batch_points) # await async method
            except Exception as e:
                return f"Upsert failed for batch {i}: {e}"
        
        # Explicit GC still helpful for heavyweight VLM artifacts
        gc.collect()
        return f"Indexed {filename} ({pipeline_type}): {len(chunks)} chunks."

    async def process_file(self, filename, content=None, filepath=None, document_set="all"):
        """Process a single file: Convert -> Chunk -> Embed -> Index."""
        return await self._process_content_flow(filename, content, filepath, document_set, use_vlm=False)

    async def process_file_vlm(self, filename, content=None, filepath=None, document_set="all"):
        """Process a single file using VLM pipeline."""
        return await self._process_content_flow(filename, content, filepath, document_set, use_vlm=True)

ingestion_service = IngestionService()
