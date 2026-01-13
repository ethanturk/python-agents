/**
 * Azure Storage client wrapper.
 * Provides file upload, download, and delete operations.
 */

import {
  BlobServiceClient,
  ContainerClient,
  BlockBlobClient,
} from "@azure/storage-blob";
import logger from "./logger.js";

// Initialize Azure Blob Service Client
let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

function initAzure(): void {
  if (blobServiceClient !== null) {
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    const error = new Error(
      "Azure Storage not configured: AZURE_STORAGE_CONNECTION_STRING environment variable is missing",
    );
    logger.error("Azure Storage initialization failed - connection string not set");
    throw error;
  }

  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME || "documents",
    );

    logger.info("Azure Storage initialized");
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Azure Storage initialization failed");
    throw err;
  }
}

/**
 * Upload a file to Azure Storage.
 * @param filename - Name of the file
 * @param buffer - File content as buffer
 * @param documentSet - Document set (subdirectory)
 * @returns URL to the uploaded file
 */
export async function uploadFile(
  filename: string,
  buffer: Buffer,
  documentSet: string = "all",
): Promise<string> {
  initAzure();

  try {
    // Create blob path with document set as subdirectory
    const blobPath =
      documentSet === "all" ? filename : `${documentSet}/${filename}`;

    const blockBlobClient: BlockBlobClient =
      containerClient!.getBlockBlobClient(blobPath);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: "application/octet-stream",
      },
    });

    logger.info({ filename, documentSet }, "File uploaded to Azure Storage");

    // Return blob URL (not storage account URL for security)
    return blobPath;
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: err.message, filename },
      "Azure Storage upload error",
    );
    throw err;
  }
}

/**
 * Download a file from Azure Storage.
 * @param filename - Name of the file
 * @param documentSet - Document set (subdirectory)
 * @returns File content as buffer and content type
 */
export async function downloadFile(
  filename: string,
  documentSet: string = "all",
): Promise<{ buffer: Buffer; contentType: string }> {
  initAzure();

  try {
    // Create blob path with document set as subdirectory
    const blobPath =
      documentSet === "all" ? filename : `${documentSet}/${filename}`;

    const blockBlobClient: BlockBlobClient =
      containerClient!.getBlockBlobClient(blobPath);

    const downloadResponse = await blockBlobClient.download();

    if (!downloadResponse.readableStreamBody) {
      throw new Error("No readable stream body in download response");
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    // Get content type from properties
    const contentType =
      downloadResponse.contentType || "application/octet-stream";

    logger.info(
      { filename, documentSet },
      "File downloaded from Azure Storage",
    );

    return { buffer, contentType };
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: err.message, filename },
      "Azure Storage download error",
    );
    throw err;
  }
}

/**
 * Delete a file from Azure Storage.
 * @param filename - Name of the file
 * @param documentSet - Document set (subdirectory)
 */
export async function deleteFile(
  filename: string,
  documentSet: string = "all",
): Promise<void> {
  initAzure();

  try {
    // Create blob path with document set as subdirectory
    const blobPath =
      documentSet === "all" ? filename : `${documentSet}/${filename}`;

    const blockBlobClient: BlockBlobClient =
      containerClient!.getBlockBlobClient(blobPath);

    await blockBlobClient.delete();

    logger.info({ filename, documentSet }, "File deleted from Azure Storage");
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: err.message, filename },
      "Azure Storage delete error",
    );
    throw err;
  }
}

/**
 * Check if a file exists in Azure Storage.
 * @param filename - Name of the file
 * @param documentSet - Document set (subdirectory)
 */
export async function fileExists(
  filename: string,
  documentSet: string = "all",
): Promise<boolean> {
  initAzure();

  try {
    // Create blob path with document set as subdirectory
    const blobPath =
      documentSet === "all" ? filename : `${documentSet}/${filename}`;

    const blockBlobClient: BlockBlobClient =
      containerClient!.getBlockBlobClient(blobPath);

    const exists = await blockBlobClient.exists();

    return exists;
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: err.message, filename },
      "Azure Storage exists check error",
    );
    return false;
  }
}

export { blobServiceClient, containerClient };
