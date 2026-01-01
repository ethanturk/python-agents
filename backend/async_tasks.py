import os
import time
from pathlib import Path
from celery import Celery
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
import config
import os
import tempfile
import uuid
import gc
from io import BytesIO
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat, DocumentStream
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue, HnswConfigDiff
from openai import OpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
import pandas as pd
import httpx
import base64
from summarizer import summarize_document

os.environ["USE_NNPACK"] = "0"

def get_model():
    return OpenAIChatModel(
        config.OPENAI_MODEL,
        provider=OpenAIProvider(
            base_url=config.OPENAI_API_BASE,
            api_key=config.OPENAI_API_KEY
        )
    )

# Initialize Celery
app = Celery('langchain_agent_sample', broker=config.CELERY_BROKER_URL, backend=config.CELERY_RESULT_BACKEND)
app.conf.task_default_queue = config.CELERY_QUEUE_NAME

# Initialize Qdrant and OpenAI Client
# Robust extraction of the host from config or hardcoded for docker
qdrant_client = QdrantClient(host=os.getenv("QDRANT_HOST", "qdrant"), port=6333, timeout=60)

openai_client = OpenAI(
    api_key=config.OPENAI_API_KEY,
    base_url=config.OPENAI_API_BASE
)

def create_stub_kb():
    """Creates a stub knowledge base file."""
    kb_path = "stub_knowledge_base.txt"
    if not os.path.exists(kb_path):
        with open(kb_path, "w") as f:
            f.write("This is a stub knowledge base. The answer to every question is '42'.")
    return kb_path

@app.task
def check_knowledge_base(user_input):
    """
    Step 1: Check if KB exists.
    """
    if not config.OPENAI_API_KEY:
        return {"error": "Missing API Key"}

    agent = Agent(
        get_model(),
        system_prompt="You are an intelligent assistant managing a codebase."
    )
    print(f"DEBUG: check_knowledge_base using model: {agent.model.model_name if hasattr(agent.model, 'model_name') else config.OPENAI_MODEL}")
    
    # Check physical existence
    kb_exists_physically = os.path.exists("stub_knowledge_base.txt")
    
    # Prompt with context
    user_prompt = (
        f"Context: File system check returns: {kb_exists_physically}.\n"
        "Does a knowledge base currently exist for this codebase? Reply 'YES' or 'NO' only."
    )
    
    try:
        response = agent.run_sync(user_prompt).output.strip().upper()
        
        kb_location = None
        if "YES" in response:
            kb_location = "existing_kb.txt"
        else:
            kb_location = create_stub_kb()
            
        return {
            "user_input": user_input,
            "kb_location": kb_location,
            "step1_decision": response
        }
    except Exception as e:
        return {"error": str(e)}

@app.task
def answer_question(context_data):
    """
    Step 2: Answer question using the KB reference.
    """
    if "error" in context_data:
        return f"Previous step failed: {context_data['error']}"
        
    user_input = context_data.get("user_input")
    kb_location = context_data.get("kb_location")
    
    if not config.OPENAI_API_KEY:
        return "Error: Missing API Key"

    # Load KB content (stub)
    kb_content = ""
    try:
        with open(kb_location, "r") as f:
            kb_content = f.read()
    except:
        kb_content = "Could not read knowledge base."

    agent_extract = Agent(
        get_model(),
        system_prompt="Extract the core question from the user input."
    )
    question = agent_extract.run_sync(user_input).output
    
    agent_answer = Agent(
        get_model(),
        system_prompt=f"Answer the user's question using this knowledge base content: {kb_content}"
    )
    final_answer = agent_answer.run_sync(question).output
    
    return f"Question Extracted: {question}\nAnswer: {final_answer}\n(Source KB: {kb_location})"


# Initialize Docling optimized converter
def get_docling_converter():
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = False
    pipeline_options.do_table_structure = True
    pipeline_options.table_structure_options.do_cell_matching = False
    pipeline_options.generate_page_images = False
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

def ensure_collection_exists():
    """Checks if collection exists and creates it if not."""
    try:
        qdrant_client.get_collection(config.QDRANT_COLLECTION_NAME)
    except Exception:
        try:
            qdrant_client.create_collection(
                collection_name=config.QDRANT_COLLECTION_NAME,
                vectors_config=VectorParams(size=config.OPENAI_EMBEDDING_DIMENSIONS, distance=Distance.COSINE),
                hnsw_config=HnswConfigDiff(m=16, ef_construct=100)
            )
        except Exception as e:
            if "Conflict" in str(e) or "409" in str(e):
                pass
            else:
                raise e

@app.task
def ingest_docs_task(files_data):
    """
    Ingest a list of files.
    files_data: list of dicts {'filename': str, 'content': str, 'filepath': str (optional)}
    """
    # Ensure collection exists
    ensure_collection_exists()

    results = []
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    
    converter = get_docling_converter()

    for file_item in files_data:
        filename = file_item['filename']
        content = file_item.get('content')
        filepath = file_item.get('filepath')

        # Check existing index
        try:
            count_result = qdrant_client.count(
                collection_name=config.QDRANT_COLLECTION_NAME,
                count_filter=Filter(must=[FieldCondition(key="filename", match=MatchValue(value=filename))])
            )
            if count_result.count > 0:
                results.append(f"Skipped {filename}: Already indexed.")
                continue
        except Exception:
            pass

        try:
            # Prepare source stream
            source = None
            temp_file_to_cleanup = None
            try:
                if content:
                    if len(content) == 0:
                        results.append(f"Skipped {filename}: Content is empty/0 bytes.")
                        continue
                    # Docling stream from bytes
                    source = DocumentStream(name=filename, stream=BytesIO(content))

                # Calculate Document Set
                document_set = file_item.get('document_set')
                
                if not document_set:
                     document_set = "default"
                     if filepath:
                         try:
                             # Clean up paths to ensure consistent comparison
                             monitored_path = Path(config.MONITORED_DIR).resolve()
                             file_path_obj = Path(config.MONITORED_DIR).joinpath(filepath).resolve() if not os.path.isabs(filepath) else Path(filepath).resolve()
                             
                             # Check if file is inside monitored_path
                             if monitored_path in file_path_obj.parents:
                                 rel_path = file_path_obj.relative_to(monitored_path)
                                 # If there are parent directories in the relative path, the first one is the doc set
                                 if len(rel_path.parts) > 1:
                                     document_set = rel_path.parts[0]
                         except Exception as e:
                             print(f"Error determining document set for {filepath}: {e}")

                if content:
                    if len(content) == 0:
                        results.append(f"Skipped {filename}: Content is empty/0 bytes.")
                        continue
                    # Docling stream from bytes
                    source = DocumentStream(name=filename, stream=BytesIO(content))
                elif filepath:
                    if not os.path.exists(filepath):
                        results.append(f"Failed {filename}: File not found at {filepath}")
                        continue
                    if os.path.getsize(filepath) == 0:
                         results.append(f"Skipped {filename}: 0-byte file at {filepath}")
                         continue
                    source = filepath
                else:
                    results.append(f"Skipped {filename}: No content or filepath provided.")
                    continue

                # Handle .xls files by converting to .xlsx
                if filename.lower().endswith('.xls'):
                    try:
                        # Read the .xls file (from bytes if available, else from path)
                        if content:
                            df_dict = pd.read_excel(BytesIO(content), sheet_name=None)
                        else:
                            df_dict = pd.read_excel(filepath, sheet_name=None)
                            
                        # Create a temporary .xlsx file
                        temp_xlsx = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
                        temp_xlsx_path = temp_xlsx.name
                        temp_xlsx.close()
                        
                        # Write all sheets to the new .xlsx file
                        with pd.ExcelWriter(temp_xlsx_path, engine='openpyxl') as writer:
                             for sheet_name, df in df_dict.items():
                                 df.to_excel(writer, sheet_name=sheet_name, index=False)
                                 
                        # Update source to point to the new temp file
                        source = temp_xlsx_path
                        temp_file_to_cleanup = temp_xlsx_path
                    except Exception as e:
                         results.append(f"Failed to convert .xls {filename}: {str(e)}")
                         continue

                # Convert
                doc_result = converter.convert(source)
                markdown_content = doc_result.document.export_to_markdown()
                
                # Explicit resource cleanup for memory safety
                if hasattr(doc_result.input, '_backend') and doc_result.input._backend:
                    try:
                        doc_result.input._backend.unload()
                    except Exception as e:
                        # Ignore specific error related to cleaning up already closed/None resources
                        if "'NoneType' object has no attribute 'close'" not in str(e):
                             print(f"Warning: Error unloading backend for {filename}: {e}")

                # Chunking
                chunks = splitter.split_text(markdown_content)
                chunks = [str(c) for c in chunks if c and str(c).strip()]
                
                if not chunks:
                     results.append(f"Skipped {filename}: No content extracted.")
                     continue

                # Embed and Index
                vectors = []
                for attempt in range(3):
                    try:
                        # Native OpenAI embedding call
                        response = openai_client.embeddings.create(
                            input=chunks,
                            model=config.OPENAI_EMBEDDING_MODEL
                        )
                        vectors = [d.embedding for d in response.data]
                        break
                    except Exception as e:
                        if attempt == 2:
                            raise e
                        time.sleep(2 * (attempt + 1))
                
                points = []
                for i, chunk in enumerate(chunks):
                    points.append(PointStruct(
                        id=str(uuid.uuid4()),
                        vector=vectors[i],
                        payload={"filename": filename, "content": chunk, "document_set": document_set}
                    ))
                    
                # Batch upsert to avoid payload limits
                batch_size = 64
                for i in range(0, len(points), batch_size):
                    try:
                        batch_points = points[i : i + batch_size]
                        qdrant_client.upsert(collection_name=config.QDRANT_COLLECTION_NAME, points=batch_points)
                    except Exception as batch_error:
                        print(f"Error upserting batch {i//batch_size}: {batch_error}")
                        if i == 0: # If the first batch fails, it might be a bigger issue, but we try to continue or raise
                             raise batch_error
                results.append(f"Indexed {filename}: {len(chunks)} chunks.")
            
            finally:
                # Cleanup temporary file if it was created
                if temp_file_to_cleanup and os.path.exists(temp_file_to_cleanup):
                    try:
                        os.remove(temp_file_to_cleanup)
                    except Exception as e:
                        print(f"Warning: Failed to cleanup temp file {temp_file_to_cleanup}: {e}")

            
        except Exception as e:
            results.append(f"Failed {filename}: {str(e)}")
        finally:
             gc.collect()

    return "\n".join(results)

@app.task(name="async_tasks.summarize_document_task")
def summarize_document_task(filename: str, content_b64: str, backend_notify_url: str):
    """
    Async task to summarize a document.
    """
    print(f"Starting async summary for {filename}")
    try:
        # Decode content
        try:
            content = base64.b64decode(content_b64)
            source = BytesIO(content)
        except Exception as e:
            return f"Error decoding content: {e}"
        
        summary = summarize_document(source, filename)
        
        if "Error" in summary and len(summary) < 200:
             status = "failed"
             result = summary
        else:
             status = "completed"
             result = summary
             
        # Notify Backend
        notification_data = {
            "type": "summary_complete",
            "filename": filename,
            "status": status,
            "result": result
        }
        
        # Helper to send notification
        try:
             # We use httpx to call back the main API
             # In docker, backend is at http://backend:8000
             # But let's use the passed URL to be flexible
             with httpx.Client() as client:
                 client.post(backend_notify_url, json=notification_data)
        except Exception as net_err:
             print(f"Failed to notify backend: {net_err}")
             
        return result

    except Exception as e:
        error_msg = f"Task failed: {str(e)}"
        print(error_msg)
        return error_msg

