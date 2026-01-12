/**
 * In-memory notification queue for long-polling.
 * Ported from api/notifications/service.py
 */

import type { Notification, NotificationData } from "./types";
import logger from "./logger";

class NotificationQueue {
  private queue: Notification[] = [];
  private lastId = 0;
  private lock = Promise.resolve();

  // Test-only reset method
  reset(): void {
    this.queue = [];
    this.lastId = 0;
  }

  async push(message: NotificationData): Promise<number> {
    await this.lock;

    this.lastId += 1;
    const notification: Notification = {
      id: this.lastId,
      timestamp: Date.now() / 1000,
      data: message,
    };

    // Limit queue size to prevent memory issues
    if (this.queue.length >= 1000) {
      this.queue.shift();
    }

    this.queue.push(notification);

    logger.info(
      { id: this.lastId, type: message.type },
      "Notification pushed to queue",
    );

    return this.lastId;
  }

  async getSince(
    sinceId: number,
    timeout: number = 20.0,
  ): Promise<Notification[]> {
    const start = Date.now();

    while (Date.now() - start < timeout * 1000) {
      const messages = this.queue.filter((msg) => msg.id > sinceId);

      if (messages.length > 0) {
        return messages;
      }

      // Wait 500ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return [];
  }
}

// Global instance
const notificationQueue = new NotificationQueue();

export async function pollNotifications(
  sinceId: number,
  timeout: number = 20.0,
): Promise<Notification[]> {
  return notificationQueue.getSince(sinceId, timeout);
}

export async function notify(
  notification: NotificationData,
): Promise<{ status: string }> {
  logger.info(
    { type: notification.type, filename: notification.filename },
    "Processing notification",
  );

  // Save summary to database if completed
  if (notification.status === "completed" && notification.result) {
    try {
      const { saveSummary } = await import("./database.js");
      await saveSummary(notification.filename || "", notification.result);
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, "DB Error saving summary");
    }
  }

  await notificationQueue.push(notification);

  return { status: "ok" };
}

export default notificationQueue;
