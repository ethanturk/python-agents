import os
import logging
import pandas as pd
import tempfile
from io import BytesIO
from typing import Union

# Docling imports
from docling.datamodel.base_models import InputFormat, DocumentStream
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.document_converter import DocumentConverter, PdfFormatOption

# PydanticAI imports
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

# LangChain Text Splitter (still used)
from langchain_text_splitters import RecursiveCharacterTextSplitter

import config

logger = logging.getLogger(__name__)

def get_model():
    return OpenAIChatModel(
        config.OPENAI_MODEL,
        provider=OpenAIProvider(
            base_url=config.OPENAI_API_BASE,
            api_key=config.OPENAI_API_KEY
        )
    )

def summarize_document(source: Union[str, BytesIO], filename: str = "document") -> str:
    """
    Summarizes the content of a document using Markitdown for robust format support.
    Accepts a filepath string or a BytesIO stream.
    Handles large documents by chunking and using a Map-Reduce approach.
    Also handles .xls files by converting them to .xlsx.
    """
    temp_xlsx_path = None
    try:
        # Determine input source and handle .xls conversion
        input_source = source

        # Check for XLS and convert if necessary
        is_xls = False
        if isinstance(source, str) and source.lower().endswith('.xls'):
            is_xls = True
        elif filename.lower().endswith('.xls'):
            is_xls = True

        if is_xls:
            try:
                # Read the .xls file
                if isinstance(source, BytesIO):
                    df_dict = pd.read_excel(source, sheet_name=None)
                else: # source is a filepath
                    df_dict = pd.read_excel(source, sheet_name=None)
                
                # Create a temporary .xlsx file
                temp_xlsx = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
                temp_xlsx_path = temp_xlsx.name
                temp_xlsx.close()
                
                # Write all sheets to the new .xlsx file
                with pd.ExcelWriter(temp_xlsx_path, engine='openpyxl') as writer:
                        for sheet_name, df in df_dict.items():
                            df.to_excel(writer, sheet_name=sheet_name, index=False)
                
                # Update source to point to the new temp file
                # Docling works best with file paths for Excel usually, or streams. 
                # Let's use the file path of the converted file.
                input_source = temp_xlsx_path
                
            except Exception as e:
                logger.error(f"Failed to convert .xls {filename}: {str(e)}")
                return f"Error: Failed to convert .xls file: {str(e)}"

        # Convert using Docling
        try:
            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = False
            pipeline_options.do_table_structure = True
            pipeline_options.table_structure_options.do_cell_matching = False
            pipeline_options.generate_page_images = False
            pipeline_options.generate_picture_images = False

            converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(
                        pipeline_options=pipeline_options,
                        backend=PyPdfiumDocumentBackend
                    )
                }
            )
            
            # If we converted to pseudo-XLSX, input_source is a path string now.
            # If it was originally a BytesIO and NOT xls, we need to wrap it in DocumentStream
            if isinstance(input_source, BytesIO):
                input_source = DocumentStream(name=filename, stream=input_source)
            elif isinstance(input_source, str):
                 if not os.path.exists(input_source):
                     return "Error: File not found."
            
            doc_result = converter.convert(input_source)
            content = doc_result.document.export_to_markdown()
        except Exception as e:
            logger.error(f"Error converting document {filename}: {e}")
            return f"Error reading document: {str(e)}"

        if temp_xlsx_path and os.path.exists(temp_xlsx_path):
            try:
                os.remove(temp_xlsx_path)
            except:
                pass

        if not content.strip():
            return "Error: Document is empty or could not be read."

        # Setup Agent
        logger.info(f"Summarizer initializing PydanticAI Agent with model: {config.OPENAI_MODEL}")
        
        # Split text if too large
        # Approximate 4 chars per token. 62k tokens ~ 248k chars.
        # We'll be conservative and split at 100k chars (~25k tokens) to be safe.
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=100000,
            chunk_overlap=5000
        )
        
        chunks = text_splitter.split_text(content)

        if len(chunks) == 1:
            # Single chunk - standard summary
            agent = Agent(
                get_model(),
                system_prompt="You are a helpful assistant that summarizes documents."
            )
            user_msg = f"Please provide a concise summary of the following document content (converted to markdown):\n\n{chunks[0]}"
            
            result = agent.run_sync(user_msg)
            return result.data
        else:
            # Multiple chunks - Map-Reduce
            logger.info(f"Document too large, splitting into {len(chunks)} chunks for summarization.")
            
            # Map Step
            map_agent = Agent(
                get_model(),
                system_prompt="You are a helpful assistant reading a part of a larger document."
            )
            
            chunk_summaries = []
            for i, chunk in enumerate(chunks):
                try:
                    user_msg = f"Please provide a concise summary of this section of the document:\n\n{chunk}"
                    chunk_result = map_agent.run_sync(user_msg)
                    chunk_summaries.append(chunk_result.data)
                except Exception as e:
                    logger.error(f"Error summarizing chunk {i}: {e}")
                    chunk_summaries.append(f"[Error in chunk {i}]")

            # Reduce Step
            combined_summaries = "\n\n".join(chunk_summaries)
            
            reduce_agent = Agent(
                get_model(),
                system_prompt="You are a helpful assistant that consolidates summaries."
            )
            
            reduce_msg = f"Here are summaries of different sections of a document. Please combine them into one concise, cohesive summary of the entire document:\n\n{combined_summaries}"
            
            final_result = reduce_agent.run_sync(reduce_msg)
            return final_result.data

    except Exception as e:
        # Cleanup in case of outer error
        if temp_xlsx_path and os.path.exists(temp_xlsx_path):
            try:
                os.remove(temp_xlsx_path)
            except:
                pass

        logger.error(f"Summarization failed: {e}")
        return f"Summarization failed: {str(e)}"
