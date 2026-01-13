/**
 * Vercel serverless function handler for Notifications API.
 * Node.js implementation.
 * Ported from api/notifications/index.py
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  PollResponse,
  ErrorResponse,
  HealthResponse,
} from "../lib/types.js";
import { pollNotifications, notify } from "../lib/notifications.js";
import logger from "../lib/logger.js";

export const vercelConfig = {
  runtime: "nodejs18.x",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  logger.info({ method: req.method, url: req.url }, "Notifications request");

  try {
    // Handle both absolute and relative URLs
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `https://${host}`);
    const pathname = url.pathname;

    // Health endpoint
    if (pathname === "/health" || pathname === "/notifications/health") {
      return res.status(200).json({ status: "ok" } as HealthResponse);
    }

    // Poll endpoint
    if (pathname === "/poll" || pathname === "/notifications/poll") {
      const sinceId = parseInt(url.searchParams.get("since_id") || "0", 10);
      const messages = await pollNotifications(sinceId, 20.0);
      return res.status(200).json({ messages } as PollResponse);
    }

    // Notify endpoint
    if (
      pathname === "/internal/notify" ||
      pathname === "/notifications/internal/notify"
    ) {
      const body = req.body as Record<string, unknown>;
      const notification = {
        type: body.type as "ingestion" | "summarization",
        filename: body.filename as string,
        status: body.status as "completed" | "failed",
        result: body.result as string | undefined,
        error: body.error as string | undefined,
      };
      const result = await notify(notification);
      return res.status(200).json(result);
    }

    // 404 for unknown routes
    return res.status(404).json({ detail: "Not found" } as ErrorResponse);
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: err.message, stack: err.stack },
      "Notifications error",
    );
    return res.status(500).json({ detail: err.message } as ErrorResponse);
  }
}
