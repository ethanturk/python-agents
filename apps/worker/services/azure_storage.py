import logging
from azure.storage.blob import BlobServiceClient
import config

logger = logging.getLogger(__name__)


class AzureStorageService:
    """Azure Blob Storage service for file operations."""

    def __init__(self):
        if not config.AZURE_STORAGE_CONNECTION_STRING:
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING not configured")

        self.account_name = config.AZURE_STORAGE_ACCOUNT_NAME
        self.container_name = config.AZURE_STORAGE_CONTAINER_NAME
        self.blob_service_client = BlobServiceClient.from_connection_string(
            config.AZURE_STORAGE_CONNECTION_STRING
        )
        self.container_client = self.blob_service_client.get_container_client(self.container_name)
        logger.info(f"Azure Storage initialized: {self.account_name}/{self.container_name}")

    async def upload_file(self, content: bytes, filename: str, document_set: str) -> bool:
        """Upload file to container/{document_set}/{filename}"""
        try:
            blob_path = f"{document_set}/{filename}"
            blob_client = self.container_client.get_blob_client(blob_path)
            blob_client.upload_blob(content, overwrite=True)
            logger.info(f"Uploaded: {blob_path} ({len(content)} bytes)")
            return True
        except Exception as e:
            logger.error(f"Azure upload failed for {filename}: {e}")
            return False

    async def download_file(self, filename: str, document_set: str) -> bytes | None:
        """Download file from container/{document_set}/{filename}"""
        try:
            blob_path = f"{document_set}/{filename}"
            blob_client = self.container_client.get_blob_client(blob_path)
            blob = blob_client.download_blob()
            content = blob.readall()
            logger.info(f"Downloaded: {blob_path} ({len(content)} bytes)")
            return content
        except Exception as e:
            logger.error(f"Azure download failed for {filename}: {e}")
            return None

    async def download_file_by_path(self, blob_path: str) -> bytes | None:
        """Download file by full path including container (e.g., 'demo/vegetables/kale.md')"""
        try:
            parts = blob_path.split("/", 1)
            if len(parts) != 2:
                raise ValueError(f"Invalid blob path format: {blob_path}")

            container_name, blob_name = parts

            container_client = self.blob_service_client.get_container_client(container_name)
            blob_client = container_client.get_blob_client(blob_name)
            blob = blob_client.download_blob()
            content = blob.readall()
            logger.info(f"Downloaded by path: {blob_path} ({len(content)} bytes)")
            return content
        except Exception as e:
            logger.error(f"Azure download by path failed for {blob_path}: {e}")
            return None

    async def delete_file(self, filename: str, document_set: str) -> bool:
        """Delete file from container/{document_set}/{filename}"""
        try:
            blob_path = f"{document_set}/{filename}"
            blob_client = self.container_client.get_blob_client(blob_path)
            blob_client.delete_blob()
            logger.info(f"Deleted: {blob_path}")
            return True
        except Exception as e:
            logger.error(f"Azure delete failed for {filename}: {e}")
            return False

    async def file_exists(self, filename: str, document_set: str) -> bool:
        """Check if file exists in container/{document_set}/{filename}"""
        try:
            blob_path = f"{document_set}/{filename}"
            blob_client = self.container_client.get_blob_client(blob_path)
            return blob_client.exists()
        except Exception as e:
            logger.error(f"Azure existence check failed for {filename}: {e}")
            return False


azure_storage_service = AzureStorageService()
