from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat, DocumentStream
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.pipeline.vlm_pipeline import VlmPipeline
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from langchain_text_splitters import RecursiveCharacterTextSplitter
from services.llm import get_embeddings_model
from services.vector_db import db_service
from qdrant_client.http.models import PointStruct
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
from services.llm import LLMService

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        self.converter = self._get_docling_converter()

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

    def _get_vlm_converter(self):
        return DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_cls=VlmPipeline,
                )
            }
        )

    def process_file(self, filename, content=None, filepath=None, document_set="all"):
        """Process a single file: Convert -> Chunk -> Embed -> Index."""
        logger.info(f"Processing file: {filename}")
        
        # 1. Convert to Markdown
        try:
            source = None
            temp_file_to_cleanup = None
            
            # Handle .xls -> .xlsx conversion
            if filename.lower().endswith('.xls'):
                try:
                    if content:
                        df_dict = pd.read_excel(BytesIO(content), sheet_name=None)
                    else:
                        df_dict = pd.read_excel(filepath, sheet_name=None)
                    
                    temp_xlsx = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
                    temp_file_to_cleanup = temp_xlsx.name
                    temp_xlsx.close()
                    
                    with pd.ExcelWriter(temp_file_to_cleanup, engine='openpyxl') as writer:
                         for sheet_name, df in df_dict.items():
                             df.to_excel(writer, sheet_name=sheet_name, index=False)
                    source = temp_file_to_cleanup
                except Exception as e:
                    return f"Failed to convert .xls {filename}: {str(e)}"
            
            elif content:
                 source = DocumentStream(name=filename, stream=BytesIO(content))
            elif filepath:
                 source = filepath
            else:
                 return "No content or filepath provided."

            doc_result = self.converter.convert(source)
            markdown_content = doc_result.document.export_to_markdown()
            
            # Cleanup backend resources
            if hasattr(doc_result.input, '_backend') and doc_result.input._backend:
                try:
                    doc_result.input._backend.unload()
                except:
                    pass
            
            # Cleanup temp file
            if temp_file_to_cleanup and os.path.exists(temp_file_to_cleanup):
                try:
                    os.remove(temp_file_to_cleanup)
                except:
                    pass

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
        # The langchain embeddings model doesn't expose 'client' directly in a way that matches the openai client usage in async_tasks
        # But we can use embed_documents
        
        try:
            vectors = embeddings_model.embed_documents(chunks)
        except Exception as e:
            return f"Embedding failed for {filename}: {e}"

        # 4. Upsert (Indexing)
        points = []
        for i, chunk in enumerate(chunks):
            points.append(PointStruct(
                id=str(uuid.uuid4()),
                vector=vectors[i],
                payload={"filename": filename, "content": chunk, "document_set": document_set}
            ))
        
        batch_size = 64
        for i in range(0, len(points), batch_size):
            try:
                batch_points = points[i : i + batch_size]
                db_service.upsert_vectors(batch_points)
            except Exception as e:
                return f"Upsert failed for batch {i}: {e}"
        
        gc.collect()
        return f"Indexed {filename}: {len(chunks)} chunks."

    def process_file_vlm(self, filename, content=None, filepath=None, document_set="all"):
        """Process a single file using VLM pipeline: Convert -> Chunk -> Embed -> Index."""
        logger.info(f"Processing file with VLM: {filename}")
        
        # 1. Convert to Markdown using VLM
        try:
            source = None
            if content:
                 source = DocumentStream(name=filename, stream=BytesIO(content))
            elif filepath:
                 source = filepath
            else:
                 return "No content or filepath provided."

            # Use a fresh VLM converter (heavy initialization might happen here)
            vlm_converter = self._get_vlm_converter()
            doc_result = vlm_converter.convert(source)
            markdown_content = doc_result.document.export_to_markdown()
            
            # Cleanup backend resources
            if hasattr(doc_result.input, '_backend') and doc_result.input._backend:
                try:
                    doc_result.input._backend.unload()
                except:
                    pass

        except Exception as e:
            return f"VLM Conversion failed for {filename}: {e}"

        # 2. Chunking (Reuse existing splitter)
        chunks = self.splitter.split_text(markdown_content)
        chunks = [str(c) for c in chunks if c and str(c).strip()]
        
        if not chunks:
            return f"Skipped {filename}: No content extracted via VLM."

        # 3. Embedding
        vectors = []
        embeddings_model = LLMService.get_embeddings()
        
        try:
            vectors = embeddings_model.embed_documents(chunks)
        except Exception as e:
            return f"Embedding failed for {filename}: {e}"

        # 4. Upsert (Indexing)
        points = []
        for i, chunk in enumerate(chunks):
            points.append(PointStruct(
                id=str(uuid.uuid4()),
                vector=vectors[i],
                payload={"filename": filename, "content": chunk, "document_set": document_set, "pipeline": "vlm"}
            ))
        
        batch_size = 64
        for i in range(0, len(points), batch_size):
            try:
                batch_points = points[i : i + batch_size]
                db_service.upsert_vectors(batch_points)
            except Exception as e:
                return f"Upsert failed for batch {i}: {e}"
        
        gc.collect()
        return f"Indexed {filename} with VLM: {len(chunks)} chunks."

ingestion_service = IngestionService()
