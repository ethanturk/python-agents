import logging

from services.docling_utils import DoclingConverterFactory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def preload():
    """
    Initializes the DocumentConverter to trigger the download of necessary artifacts/models.
    """
    print("Preloading Docling models...")
    try:
        converter = DoclingConverterFactory.create_standard_converter()
        print("DocumentConverter initialized successfully.")
    except Exception as e:
        print(f"Error preloading models: {e}")
        exit(1)


if __name__ == "__main__":
    preload()
