import os
import logging
import pandas as pd
import tempfile
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.document_converter import DocumentConverter, PdfFormatOption
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
import config

logger = logging.getLogger(__name__)

from io import BytesIO
from typing import Union
from docling.datamodel.base_models import DocumentStream

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
        final
        if temp_xlsx_path and os.path.exists(temp_xlsx_path):
            try:
                os.remove(temp_xlsx_path)
            except:
                pass

        if not content.strip():
            return "Error: Document is empty or could not be read."

        # Setup LLM
        llm = ChatOpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=config.OPENAI_API_BASE,
            model=config.OPENAI_MODEL
        )

        # Split text if too large
        # Approximate 4 chars per token. 62k tokens ~ 248k chars.
        # We'll be conservative and split at 100k chars (~25k tokens) to be safe and allow room for map/reduce prompts.
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=100000,
            chunk_overlap=5000
        )
        
        chunks = text_splitter.split_text(content)

        if len(chunks) == 1:
            # Single chunk - standard summary
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a helpful assistant that summarizes documents."),
                ("user", "Please provide a concise summary of the following document content (converted to markdown):\n\n{text}")
            ])
            chain = prompt | llm | StrOutputParser()
            summary = chain.invoke({"text": chunks[0]})
            return summary
        else:
            # Multiple chunks - Map-Reduce
            logger.info(f"Document too large, splitting into {len(chunks)} chunks for summarization.")
            
            # Map Step
            map_prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a helpful assistant reading a part of a larger document."),
                ("user", "Please provide a concise summary of this section of the document:\n\n{text}")
            ])
            map_chain = map_prompt | llm | StrOutputParser()
            
            chunk_summaries = []
            for i, chunk in enumerate(chunks):
                try:
                    chunk_summary = map_chain.invoke({"text": chunk})
                    chunk_summaries.append(chunk_summary)
                except Exception as e:
                    logger.error(f"Error summarizing chunk {i}: {e}")
                    chunk_summaries.append(f"[Error in chunk {i}]")

            # Reduce Step
            combined_summaries = "\n\n".join(chunk_summaries)
            reduce_prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a helpful assistant that consolidates summaries."),
                ("user", "Here are summaries of different sections of a document. Please combine them into one concise, cohesive summary of the entire document:\n\n{text}")
            ])
            reduce_chain = reduce_prompt | llm | StrOutputParser()
            
            final_summary = reduce_chain.invoke({"text": combined_summaries})
            return final_summary

    except Exception as e:
        # Cleanup in case of outer error
        if temp_xlsx_path and os.path.exists(temp_xlsx_path):
            try:
                os.remove(temp_xlsx_path)
            except:
                pass

        logger.error(f"Summarization failed: {e}")
        return f"Summarization failed: {str(e)}"
