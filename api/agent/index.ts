/**
 * Vercel serverless function handler for Agent API.
 * Node.js implementation.
 * Ported from api/agent/index.py
 */

import type {
  AgentRequest,
  AgentResponse,
  TaskResponse,
  SearchRequest,
  ErrorResponse,
  HealthResponse,
} from "../../backend-nodejs/common/types.js";
import {
  runSyncAgent,
  generateEmbedding,
} from "../../backend-nodejs/common/llm.js";
import { matchDocuments } from "../../backend-nodejs/common/supabase.js";
import {
  submitTask,
  getTaskStatus,
} from "../../backend-nodejs/common/queue.js";
import { config } from "../../backend-nodejs/common/config.js";
import logger from "../../backend-nodejs/common/logger.js";

export const vercelConfig = {
  runtime: "nodejs18.x",
};

export default async function handler(request: Request, context: any) {
  logger.info({ method: request.method, url: request.url }, "Agent request");

  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health endpoint
    if (pathname === "/health" || pathname === "/agent/health") {
      return Response.json({ status: "ok" } as HealthResponse);
    }

    // Sync agent endpoint
    if (pathname === "/agent/sync") {
      const body = (await request.json()) as AgentRequest;
      const response = await runSyncAgent(body.prompt);
      return Response.json({ response } as AgentResponse);
    }

    // Async agent endpoint
    if (pathname === "/agent/async") {
      const body = (await request.json()) as AgentRequest;
      const taskId = await submitTask("agent_async", { prompt: body.prompt });
      return Response.json({ task_id: taskId });
    }

    // Agent status endpoint
    if (pathname.startsWith("/agent/status/")) {
      const taskId = pathname.split("/").pop();
      if (taskId) {
        const status = await getTaskStatus(taskId);
        return Response.json(status);
      }
    }

    // Search endpoint (RAG)
    if (pathname === "/agent/search") {
      const body = (await request.json()) as SearchRequest;

      // Generate embedding for query
      const embedding = await generateEmbedding(body.prompt);

      // Search documents
      const limit = body.limit || 10;
      const documentSet = body.document_set || "all";

      const results = await matchDocuments(embedding, 0.7, limit, documentSet);

      return Response.json(results);
    }

    // 404 for unknown routes
    return Response.json({ detail: "Not found" } as ErrorResponse, {
      status: 404,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, "Agent error");
    return Response.json({ detail: err.message } as ErrorResponse, {
      status: 500,
    });
  }
}
