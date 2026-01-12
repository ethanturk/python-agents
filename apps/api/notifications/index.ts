/**
 * Vercel serverless function handler for Notifications API.
 * Node.js implementation.
 * Ported from api/notifications/index.py
 */

import type {
  PollResponse,
  ErrorResponse,
  HealthResponse,
} from "../lib/types.js";
import {
  pollNotifications,
  notify,
} from "../lib/notifications.js";
import logger from "../lib/logger.js";

export const vercelConfig = {
  runtime: "nodejs18.x",
};

export default async function handler(request: Request, _context: unknown) {
  logger.info(
    { method: request.method, url: request.url },
    "Notifications request",
  );

  try {
    // Handle both absolute and relative URLs
    const url = new URL(request.url, `https://${request.headers.get('host') || 'localhost'}`);
    const pathname = url.pathname;

    // Health endpoint
    if (pathname === "/health" || pathname === "/notifications/health") {
      return Response.json({ status: "ok" } as HealthResponse);
    }

    // Poll endpoint
    if (pathname === "/poll" || pathname === "/notifications/poll") {
      const sinceId = parseInt(url.searchParams.get("since_id") || "0", 10);
      const messages = await pollNotifications(sinceId, 20.0);
      return Response.json({ messages } as PollResponse);
    }

    // Notify endpoint
    if (
      pathname === "/internal/notify" ||
      pathname === "/notifications/internal/notify"
    ) {
      const body = (await request.json()) as Record<string, unknown>;
      const notification = {
        type: body.type as "ingestion" | "summarization",
        filename: body.filename as string,
        status: body.status as "completed" | "failed",
        result: body.result as string | undefined,
        error: body.error as string | undefined,
      };
      const result = await notify(notification);
      return Response.json(result);
    }

    // 404 for unknown routes
    return Response.json({ detail: "Not found" } as ErrorResponse, {
      status: 404,
    });
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: err.message, stack: err.stack },
      "Notifications error",
    );
    return Response.json({ detail: err.message } as ErrorResponse, {
      status: 500,
    });
  }
}
