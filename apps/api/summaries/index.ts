/**
 * Vercel serverless function handler for Summaries API.
 * Node.js implementation.
 * Ported from api/summaries/index.py
 */

import type {
  SummariesResponse,
  SummaryQARequest,
  SearchQARequest,
  ErrorResponse,
  HealthResponse,
} from "../lib/types.js";
import {
  getAllSummaries,
  getSummaryByFilename,
} from "../lib/database.js";
import { runQAAgent } from "../lib/llm.js";
import { matchDocuments } from "../lib/supabase.js";
import { submitTask } from "../lib/queue.js";
import { generateEmbedding } from "../lib/llm.js";
import logger from "../lib/logger.js";

export const vercelConfig = {
  runtime: "nodejs18.x",
};

export default async function handler(request: Request, _context: unknown) {
  logger.info(
    { method: request.method, url: request.url },
    "Summaries request",
  );

  try {
    // Handle both absolute and relative URLs
    const url = new URL(request.url, `https://${request.headers.get('host') || 'localhost'}`);
    const pathname = url.pathname;

    // Health endpoint
    if (pathname === "/health" || pathname === "/summaries/health") {
      return Response.json({ status: "ok" } as HealthResponse);
    }

    // Get all summaries endpoint
    if (pathname === "/agent/summaries") {
      const summaries = await getAllSummaries();
      return Response.json({ summaries } as SummariesResponse);
    }

    // Summary QA endpoint
    if (pathname === "/agent/summary_qa") {
      const body = (await request.json()) as SummaryQARequest;

      // Get summary from database
      const summary = await getSummaryByFilename(body.filename);

      if (!summary) {
        return Response.json({ detail: "Summary not found" } as ErrorResponse, {
          status: 404,
        });
      }

      // Run QA agent with summary as context
      const answer = await runQAAgent(body.question, summary.summary);

      return Response.json({ response: answer });
    }

    // Search QA endpoint
    if (pathname === "/agent/search_qa") {
      const body = (await request.json()) as SearchQARequest;

      // Generate embedding for question
      const embedding = await generateEmbedding(body.question);

      // Search documents
      const results = await matchDocuments(
        embedding,
        0.7,
        10,
        body.document_set || "all",
      );

      // Format search results as context string
      const context = results
        .map(
          (r) =>
            `Document: ${r.filename}\nDocument Set: ${r.document_set}\nContent: ${r.content}\nSimilarity: ${r.similarity}\n`,
        )
        .join("\n---\n");

      // Run QA agent with search context
      const answer = await runQAAgent(body.question, context);

      return Response.json({ response: answer });
    }

    // Summarize endpoint (async task)
    if (pathname === "/agent/summarize") {
      const body = (await request.json()) as { filename: string; url?: string };
      const taskId = await submitTask("summarize", {
        filename: body.filename,
        url: body.url,
      });

      // Return task_id and webhook URL
      const webhookUrl = `${url.origin}/internal/notify`;
      return Response.json({
        task_id: taskId,
        webhook_url: webhookUrl,
      });
    }

    // 404 for unknown routes
    return Response.json({ detail: "Not found" } as ErrorResponse, {
      status: 404,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, "Summaries error");
    return Response.json({ detail: err.message } as ErrorResponse, {
      status: 500,
    });
  }
}
