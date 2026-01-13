/**
 * Vercel serverless function handler for Documents API.
 * Node.js implementation.
 * Ported from api/documents/index.py
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  DocumentListResponse,
  DocumentSetsResponse,
  ErrorResponse,
  HealthResponse,
} from "../../lib/types.js";
import {
  getDocuments,
  getDocumentSets,
  deleteDocuments,
} from "../../lib/supabase.js";
import {
  uploadFile,
  downloadFile,
  deleteFile,
} from "../../lib/azure.js";
import { submitTask } from "../../lib/queue.js";
import logger from "../../lib/logger.js";
import busboy from "busboy";
import { Readable } from "stream";

export const vercelConfig = {
  runtime: "nodejs18.x",
  maxDuration: 60,
};

// Helper: Sanitize document set name (same as Python)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sanitizeDocumentSet(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  logger.info({ method: req.method, url: req.url }, "Documents request");

  // Handle OPTIONS preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Handle both absolute and relative URLs
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `https://${host}`);
    const pathname = url.pathname;

    // Health endpoint
    if (
      pathname === "/health" ||
      pathname === "/documents/health" ||
      pathname === "/api/documents/health"
    ) {
      return res.status(200).json({ status: "ok" } as HealthResponse);
    }

    // GET documents list
    if (
      pathname === "/agent/documents" ||
      pathname === "/api/agent/documents"
    ) {
      const documentSet = url.searchParams.get("document_set") || "all";
      const results = await getDocuments(documentSet);

      // Format results with chunk_count
      const documents = results.map((r) => ({
        id: `${r.document_set}/${r.filename}`,
        filename: r.filename,
        document_set: r.document_set,
        chunk_count:
          ((r as unknown as Record<string, unknown>).chunk_count as number) ||
          1,
      }));

      return res.status(200).json({ documents } as DocumentListResponse);
    }

    // GET document sets
    if (
      pathname === "/agent/documentsets" ||
      pathname === "/api/agent/documentsets"
    ) {
      const documentSets = await getDocumentSets();
      return res.status(200).json({
        document_sets: documentSets,
      } as DocumentSetsResponse);
    }

    // POST upload documents
    if (
      (pathname === "/agent/upload" || pathname === "/api/agent/upload") &&
      req.method === "POST"
    ) {
      return new Promise<void>((resolve) => {
        const bb = busboy({ headers: req.headers });
        let documentSet = "all";
        let filename = "";
        const chunks: Buffer[] = [];

        bb.on("field", (name, val) => {
          if (name === "document_set") {
            documentSet = sanitizeDocumentSet(val);
          }
        });

        bb.on("file", (name, file, info) => {
          filename = info.filename;
          logger.info({ filename, documentSet }, "Receiving file upload");

          file.on("data", (data: Buffer) => {
            chunks.push(data);
          });

          file.on("end", () => {
            logger.info({ filename, size: chunks.length }, "File data received");
          });
        });

        bb.on("finish", async () => {
          try {
            if (!filename || chunks.length === 0) {
              res.status(400).json({
                detail: "No file uploaded",
              } as ErrorResponse);
              resolve();
              return;
            }

            const fileBuffer = Buffer.concat(chunks);

            // Check if Azure Storage is configured
            if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
              logger.warn("Azure Storage not configured - using mock storage");

              // For development/testing without Azure Storage
              // Submit ingestion task with file buffer in payload
              const taskId = await submitTask("ingest_document", {
                filename,
                document_set: documentSet,
                file_buffer: fileBuffer.toString("base64"),
              });

              logger.info({ taskId, filename }, "Ingestion task submitted (mock)");

              res.status(200).json({
                message: "File uploaded successfully (mock storage)",
                task_id: taskId,
                filename,
                document_set: documentSet,
              });
              resolve();
              return;
            }

            // Upload file to Azure Storage
            const fileUrl = await uploadFile(filename, fileBuffer, documentSet);
            logger.info({ filename, fileUrl }, "File uploaded to Azure");

            // Submit ingestion task
            const taskId = await submitTask("ingest_document", {
              filename,
              document_set: documentSet,
              file_url: fileUrl,
            });

            logger.info({ taskId, filename }, "Ingestion task submitted");

            res.status(200).json({
              message: "File uploaded successfully",
              task_id: taskId,
              filename,
              document_set: documentSet,
            });
            resolve();
          } catch (error) {
            const err = error as Error;
            logger.error(
              { error: err.message, filename },
              "File upload failed",
            );
            res.status(500).json({ detail: err.message } as ErrorResponse);
            resolve();
          }
        });

        bb.on("error", (error: Error) => {
          logger.error({ error: error.message }, "Busboy error");
          res.status(500).json({ detail: error.message } as ErrorResponse);
          resolve();
        });

        // Convert request to readable stream and pipe to busboy
        const stream = Readable.from(req as unknown as AsyncIterable<Buffer>);
        stream.pipe(bb);
      });
    }

    // DELETE document
    if (
      (pathname.startsWith("/agent/documents/") ||
        pathname.startsWith("/api/agent/documents/")) &&
      req.method === "DELETE"
    ) {
      const parts = pathname.split("/");
      const filename = parts[3] || parts[4] || "";
      const documentSet = url.searchParams.get("document_set") || "all";

      // Delete from Azure Storage
      await deleteFile(filename, documentSet);

      // Delete from Supabase (vector DB)
      await deleteDocuments(filename, documentSet);

      return res.status(200).json({ status: "ok" });
    }

    // GET file (proxy endpoint)
    if (
      pathname.startsWith("/agent/files/") ||
      pathname.startsWith("/api/agent/files/")
    ) {
      const parts = pathname.startsWith("/api/agent/files/")
        ? pathname.split("/api/agent/files/")
        : pathname.split("/agent/files/");
      if (parts.length > 1) {
        const pathParts = parts[1].split("/");
        const documentSet = pathParts.length > 1 ? pathParts[0] : "all";
        const filename =
          pathParts.length > 1 ? pathParts.slice(1).join("/") : pathParts[0];

        // Download file from Azure Storage
        const { buffer, contentType } = await downloadFile(
          filename,
          documentSet,
        );

        // Return file with correct content type
        res.setHeader("Content-Type", contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        return res.status(200).send(buffer);
      }
    }

    // 404 for unknown routes
    return res.status(404).json({ detail: "Not found" } as ErrorResponse);
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, "Documents error");
    return res.status(500).json({ detail: err.message } as ErrorResponse);
  }
}
