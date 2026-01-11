/**
 * Vercel serverless function handler for Notifications API.
 * Node.js implementation.
 * Ported from api/notifications/index.py
 */

import type { PollResponse, ErrorResponse, HealthResponse } from '../../backend-nodejs/common/types.js';
import { pollNotifications, notify } from '../../backend-nodejs/common/notifications.js';
import logger from '../../backend-nodejs/common/logger.js';

export const vercelConfig = {
  runtime: 'nodejs18.x',
};

export default async function handler(request: Request, context: any) {
  logger.info({ method: request.method, url: request.url }, 'Notifications request');

  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health endpoint
    if (pathname === '/health' || pathname === '/notifications/health') {
      return Response.json({ status: 'ok' } as HealthResponse);
    }

    // Poll endpoint
    if (pathname === '/poll' || pathname === '/notifications/poll') {
      const sinceId = parseInt(url.searchParams.get('since_id') || '0', 10);
      const messages = await pollNotifications(sinceId, 20.0);
      return Response.json({ messages } as PollResponse);
    }

    // Notify endpoint
    if (pathname === '/internal/notify' || pathname === '/notifications/internal/notify') {
      const body = await request.json() as Record<string, unknown>;
      const notification = {
        type: body.type,
        filename: body.filename,
        status: body.status,
        result: body.result,
        error: body.error,
      } as any;
      const result = await notify(notification);
      return Response.json(result);
    }

    // 404 for unknown routes
    return Response.json({ detail: 'Not found' } as ErrorResponse, { status: 404 });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Notifications error');
    return Response.json({ detail: err.message } as ErrorResponse, {
      status: 500,
    });
  }
}
