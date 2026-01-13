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
  uploadFile as _uploadFile,
  downloadFile,
  deleteFile,
} from "../../lib/azure.js";
import { submitTask as _submitTask } from "../../lib/queue.js";
import logger from "../../lib/logger.js";

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
      // Note: File upload handling would need multipart parser for Node.js runtime
      // For now, return not implemented
      logger.warn(
        "File upload endpoint called - needs multipart parser implementation",
      );
      return res.status(501).json({
        detail:
          "File upload not implemented in Node.js runtime - use Python backend",
      } as ErrorResponse);
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
