from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.pipeline.vlm_pipeline import VlmPipeline


class DoclingConverterFactory:
    """Factory for creating configured Docling document converters."""

    @staticmethod
    def get_standard_pipeline_options() -> PdfPipelineOptions:
        """Get standard PDF pipeline options."""
        options = PdfPipelineOptions()
        options.do_ocr = False
        options.do_table_structure = True
        options.table_structure_options.do_cell_matching = False
        options.generate_page_images = False
        options.generate_picture_images = False
        return options

    @staticmethod
    def create_standard_converter() -> DocumentConverter:
        """Create standard document converter (no OCR, table structure)."""
        return DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=DoclingConverterFactory.get_standard_pipeline_options(),
                    backend=PyPdfiumDocumentBackend,
                )
            }
        )

    @staticmethod
    def create_vlm_converter() -> DocumentConverter:
        """Create VLM document converter."""
        return DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_cls=VlmPipeline)}
        )
