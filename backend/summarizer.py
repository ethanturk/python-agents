import os
import logging
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.document_converter import DocumentConverter, PdfFormatOption
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import config

logger = logging.getLogger(__name__)

from io import BytesIO
from typing import Union
from docling.datamodel.base_models import DocumentStream

def summarize_document(source: Union[str, BytesIO], filename: str = "document") -> str:
    """
    Summarizes the content of a document using Markitdown for robust format support.
    Accepts a filepath string or a BytesIO stream.
    Assumes the content fits within the context window.
    """
    try:
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
            # Determine input source
            input_source = source
            if isinstance(source, BytesIO):
                input_source = DocumentStream(name=filename, stream=source)
            elif isinstance(source, str):
                 if not os.path.exists(source):
                     return "Error: File not found."
            
            doc_result = converter.convert(input_source)
            content = doc_result.document.export_to_markdown()
        except Exception as e:
            logger.error(f"Error converting document {filename}: {e}")
            return f"Error reading document: {str(e)}"

        if not content.strip():
            return "Error: Document is empty or could not be read."

        # Setup LLM
        llm = ChatOpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=config.OPENAI_API_BASE,
            model=config.OPENAI_MODEL
        )

        # Create Prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful assistant that summarizes documents."),
            ("user", "Please provide a concise summary of the following document content (converted to markdown):\n\n{text}")
        ])

        chain = prompt | llm | StrOutputParser()
        
        # Execute
        summary = chain.invoke({"text": content})
        return summary

    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        return f"Summarization failed: {str(e)}"
