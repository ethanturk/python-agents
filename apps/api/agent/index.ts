/**
 * Vercel serverless function handler for Agent API.
 * Node.js implementation.
 * Ported from api/agent/index.py
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  AgentRequest,
  AgentResponse,
  SearchRequest,
  ErrorResponse,
  HealthResponse,
} from "../lib/types.js";
import { runSyncAgent, generateEmbedding } from "../lib/llm.js";
import { matchDocuments } from "../lib/supabase.js";
import { submitTask, getTaskStatus } from "../lib/queue.js";
import logger from "../lib/logger.js";

export const vercelConfig = {
  runtime: "nodejs18.x",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  logger.info({ method: req.method, url: req.url }, "Agent request");

  try {
    // Handle both absolute and relative URLs
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `https://${host}`);
    const pathname = url.pathname;

    // Health endpoint
    if (pathname === "/health" || pathname === "/agent/health") {
      return res.status(200).json({ status: "ok" } as HealthResponse);
    }

    // Sync agent endpoint
    if (pathname === "/agent/sync") {
      const body = req.body as AgentRequest;
      const response = await runSyncAgent(body.prompt);
      return res.status(200).json({ response } as AgentResponse);
    }

    // Async agent endpoint
    if (pathname === "/agent/async") {
      const body = req.body as AgentRequest;
      const taskId = await submitTask("agent_async", { prompt: body.prompt });
      return res.status(200).json({ task_id: taskId });
    }

    // Agent status endpoint
    if (pathname.startsWith("/agent/status/")) {
      const taskId = pathname.split("/").pop();
      if (taskId) {
        const status = await getTaskStatus(taskId);
        return res.status(200).json(status);
      }
    }

    // Search endpoint (RAG)
    if (pathname === "/agent/search") {
      const body = req.body as SearchRequest;

      // Generate embedding for query
      const embedding = await generateEmbedding(body.prompt);

      // Search documents
      const limit = body.limit || 10;
      const documentSet = body.document_set || "all";

      const results = await matchDocuments(embedding, 0.7, limit, documentSet);

      return res.status(200).json(results);
    }

    // 404 for unknown routes
    return res.status(404).json({ detail: "Not found" } as ErrorResponse);
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, "Agent error");
    return res.status(500).json({ detail: err.message } as ErrorResponse);
  }
}
