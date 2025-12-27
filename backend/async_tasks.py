import os
import time
from celery import Celery
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
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
from qdrant_client.http.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

os.environ["USE_NNPACK"] = "0"

# Initialize Celery
app = Celery('langchain_agent_sample', broker=config.CELERY_BROKER_URL, backend=config.CELERY_RESULT_BACKEND)

# Initialize Qdrant and Embeddings
# Robust extraction of the host from config or hardcoded for docker
qdrant_client = QdrantClient(host=os.getenv("QDRANT_HOST", "qdrant"), port=6333, timeout=60)
embeddings_model = OpenAIEmbeddings(
    api_key=config.OPENAI_API_KEY, 
    base_url=config.OPENAI_API_BASE,
    model=config.OPENAI_EMBEDDING_MODEL, # Use a standard small model for embeddings
    check_embedding_ctx_length=False
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

    llm = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_MODEL
    )
    print(f"DEBUG: check_knowledge_base using model: {llm.model_name}")
    
    # Prompt 1: Does a knowledge base currently exist?
    # We provide some context or just ask. Since I am an AI, I don't know the file system unless told.
    # However, for the sake of the exercise, we will ask the LLM to determined it based on a "system context"
    # OR we just implement the logic: Ask LLM, if it says "No", we make one.
    # To make it interesting, we'll prompt the LLM about the concept of a KB for "this codebase".
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an intelligent assistant managing a codebase."),
        ("user", "Does a knowledge base currently exist for this codebase? Reply 'YES' or 'NO' only.")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    # We might simulate "this codebase" context by just checking real file existence 
    # and feeding that to the prompt, or just letting the LLM hallucinate.
    # The requirement says "Prompt - Does a knowledge base currently exist...".
    # I will let the LLM decide. If it says NO, I create one.
    
    kb_exists_physically = os.path.exists("stub_knowledge_base.txt")
    context = f"File system check returns: {kb_exists_physically}"
    
    try:
        response = chain.invoke({"input": ""}).strip().upper()
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

    llm = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_MODEL
    )
    print(f"DEBUG: answer_question using model: {llm.model_name}")

    # Load KB content (stub)
    kb_content = ""
    try:
        with open(kb_location, "r") as f:
            kb_content = f.read()
    except:
        kb_content = "Could not read knowledge base."

    # Prompt 2: What question does the user want answered?
    
    prompt_extract = ChatPromptTemplate.from_messages([
        ("system", "Extract the core question from the user input."),
        ("user", "{input}")
    ])
    
    chain_extract = prompt_extract | llm | StrOutputParser()
    question = chain_extract.invoke({"input": user_input})
    
    prompt_answer = ChatPromptTemplate.from_messages([
        ("system", f"Answer the user's question using this knowledge base content: {kb_content}"),
        ("user", "{question}")
    ])
    
    chain_answer = prompt_answer | llm | StrOutputParser()
    final_answer = chain_answer.invoke({"question": question})
    
    return f"Question Extracted: {question}\nAnswer: {final_answer}\n(Source KB: {kb_location})"


# Initialize Docling optimized converter
def get_docling_converter():
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

@app.task
def ingest_docs_task(files_data):
    """
    Ingest a list of files.
    files_data: list of dicts {'filename': str, 'content': str, 'filepath': str (optional)}
    """
    # Ensure collection exists
    try:
        qdrant_client.get_collection("documents")
    except Exception:
        try:
            qdrant_client.create_collection(
                collection_name="documents",
                vectors_config=VectorParams(size=config.OPENAI_EMBEDDING_DIMENSIONS, distance=Distance.COSINE)
            )
        except Exception as e:
            if "Conflict" in str(e) or "409" in str(e):
                pass
            else:
                raise e

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
                collection_name="documents",
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

            # Convert
            doc_result = converter.convert(source)
            markdown_content = doc_result.document.export_to_markdown()
            
            # Explicit resource cleanup for memory safety
            if hasattr(doc_result.input, '_backend') and doc_result.input._backend:
                doc_result.input._backend.unload()

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
                    vectors = embeddings_model.embed_documents(chunks)
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
                    payload={"filename": filename, "content": chunk}
                ))
                
            # Batch upsert to avoid payload limits
            batch_size = 64
            for i in range(0, len(points), batch_size):
                try:
                    batch_points = points[i : i + batch_size]
                    qdrant_client.upsert(collection_name="documents", points=batch_points)
                except Exception as batch_error:
                    print(f"Error upserting batch {i//batch_size}: {batch_error}")
                    if i == 0: # If the first batch fails, it might be a bigger issue, but we try to continue or raise
                         raise batch_error
            results.append(f"Indexed {filename}: {len(chunks)} chunks.")
            
        except Exception as e:
            results.append(f"Failed {filename}: {str(e)}")
        finally:
             gc.collect()

    return "\n".join(results)
