import os
import logging
from docling.document_converter import DocumentConverter
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import config

logger = logging.getLogger(__name__)

def summarize_document(filepath: str) -> str:
    """
    Summarizes the content of a document using Markitdown for robust format support.
    Assumes the content fits within the context window.
    """
    try:
        if not os.path.exists(filepath):
            return "Error: File not found."

        # Convert using Docling
        try:
            converter = DocumentConverter()
            doc_result = converter.convert(filepath)
            content = doc_result.document.export_to_markdown()
        except Exception as e:
            logger.error(f"Error converting document {filepath}: {e}")
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
