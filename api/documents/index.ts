/**
 * Vercel serverless function handler for Documents API.
 * Node.js implementation.
 * Ported from api/documents/index.py
 */

import type {
  DocumentListResponse,
  DocumentSetsResponse,
  ErrorResponse,
  HealthResponse,
} from "../../backend-nodejs/common/types.js";
import {
  getDocuments,
  getDocumentSets,
  deleteDocuments,
} from "../../backend-nodejs/common/supabase.js";
import {
  uploadFile,
  downloadFile,
  deleteFile,
} from "../../backend-nodejs/common/azure.js";
import { submitTask } from "../../backend-nodejs/common/queue.js";
import logger from "../../backend-nodejs/common/logger.js";

export const vercelConfig = {
  runtime: "nodejs18.x",
};

// Helper: Sanitize document set name (same as Python)
function sanitizeDocumentSet(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export default async function handler(request: Request, context: any) {
  logger.info(
    { method: request.method, url: request.url },
    "Documents request",
  );

  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health endpoint
    if (pathname === "/health" || pathname === "/documents/health") {
      return Response.json({ status: "ok" } as HealthResponse);
    }

    // GET documents list
    if (pathname === "/agent/documents") {
      const documentSet = url.searchParams.get("document_set") || "all";
      const results = await getDocuments(documentSet);

      // Format results with chunk_count
      const documents = results.map((r) => ({
        id: `${r.document_set}/${r.filename}`,
        filename: r.filename,
        document_set: r.document_set,
        chunk_count: (r as any).chunk_count || 1,
      }));

      return Response.json({ documents } as DocumentListResponse);
    }

    // GET document sets
    if (pathname === "/agent/documentsets") {
      const documentSets = await getDocumentSets();
      return Response.json({
        document_sets: documentSets,
      } as DocumentSetsResponse);
    }

    // POST upload documents
    if (pathname === "/agent/upload" && request.method === "POST") {
      const formData = await request.formData();
      const documentSet = sanitizeDocumentSet(
        formData.get("document_set") as string,
      );

      const files: Array<{ name: string; buffer: Buffer }> = [];

      // Process uploaded files
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const buffer = Buffer.from(await value.arrayBuffer());
          files.push({ name: value.name, buffer });
        }
      }

      // Upload each file to Azure Storage
      for (const file of files) {
        await uploadFile(file.name, file.buffer, documentSet);

        // Submit ingestion task to queue
        await submitTask("ingest_docs", {
          filename: file.name,
          document_set: documentSet,
        });
      }

      return Response.json({
        status: "ok",
        files_uploaded: files.length,
        document_set: documentSet,
      });
    }

    // DELETE document
    if (
      pathname.startsWith("/agent/documents/") &&
      request.method === "DELETE"
    ) {
      const parts = pathname.split("/");
      const filename = parts[3] || "";
      const documentSet = url.searchParams.get("document_set") || "all";

      // Delete from Azure Storage
      await deleteFile(filename, documentSet);

      // Delete from Supabase (vector DB)
      await deleteDocuments(filename, documentSet);

      return Response.json({ status: "ok" });
    }

    // GET file (proxy endpoint)
    if (pathname.startsWith("/agent/files/")) {
      const parts = pathname.split("/agent/files/");
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
        return new Response(buffer, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }
    }

    // 404 for unknown routes
    return Response.json({ detail: "Not found" } as ErrorResponse, {
      status: 404,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, "Documents error");
    return Response.json({ detail: err.message } as ErrorResponse, {
      status: 500,
    });
  }
}
