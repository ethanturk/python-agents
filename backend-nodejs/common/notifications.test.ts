/**
 * Unit tests for notification queue (backend-nodejs/common/notifications.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import notificationQueue, {
  pollNotifications,
  notify,
} from "./notifications.js";
import type { NotificationData } from "./types";

describe("NotificationQueue - Integration Tests", () => {
  beforeEach(() => {
    notificationQueue.reset();
  });
  it("should push and retrieve notifications", async () => {
    const message: NotificationData = {
      type: "ingestion",
      filename: "test.pdf",
      status: "completed",
    };

    await notify(message);
    const messages = await pollNotifications(0, 0.1);

    expect(messages).toHaveLength(1);
    expect(messages[0].data).toEqual(message);
  });

  it("should not retrieve messages with IDs <= sinceId", async () => {
    const message: NotificationData = {
      type: "ingestion",
      status: "completed",
    };

    await notify(message);
    await notify(message);
    await notify(message);

    const messages1 = await pollNotifications(0, 0.1);
    expect(messages1).toHaveLength(3);

    const messages2 = await pollNotifications(2, 0.1);
    expect(messages2).toHaveLength(1);
    expect(messages2[0].data).toEqual(message);
  });

  it("should increment notification IDs sequentially", async () => {
    const message1: NotificationData = {
      type: "ingestion",
      status: "completed",
    };
    const message2: NotificationData = {
      type: "summarization",
      status: "failed",
    };

    await notify(message1);
    await notify(message2);

    const messages = await pollNotifications(0, 0.1);
    expect(messages[0].id).toBe(1);
    expect(messages[1].id).toBe(2);
  });

  it("should add timestamp to notifications", async () => {
    const before = Date.now();
    const message: NotificationData = {
      type: "ingestion",
      status: "completed",
    };
    await notify(message);
    const after = Date.now();

    const messages = await pollNotifications(0, 0.1);
    expect(messages[0].timestamp).toBeGreaterThanOrEqual(before / 1000);
    expect(messages[0].timestamp).toBeLessThanOrEqual(after / 1000);
  });

  it("should wait for new messages with long-polling", async () => {
    const startTime = Date.now();

    const pollPromise = pollNotifications(0, 2.0);

    setTimeout(async () => {
      await notify({ type: "ingestion", status: "completed" });
    }, 500);

    const messages = await pollPromise;
    const elapsed = Date.now() - startTime;

    expect(messages).toHaveLength(1);
    expect(elapsed).toBeGreaterThan(400);
    expect(elapsed).toBeLessThan(2000);
  });

  it("should timeout and return empty if no messages arrive", async () => {
    const startTime = Date.now();
    const messages = await pollNotifications(999, 0.5);
    const elapsed = Date.now() - startTime;

    expect(messages).toHaveLength(0);
    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(700);
  });

  it("should handle multiple notifications types", async () => {
    const ingestion: NotificationData = {
      type: "ingestion",
      filename: "doc.pdf",
      status: "completed",
    };
    const summarization: NotificationData = {
      type: "summarization",
      filename: "doc.pdf",
      status: "completed",
      result: "Summary text",
    };

    await notify(ingestion);
    await notify(summarization);

    const messages = await pollNotifications(0, 0.1);
    expect(messages).toHaveLength(2);
    expect(messages[0].data.type).toBe("ingestion");
    expect(messages[1].data.type).toBe("summarization");
  });

  it("should handle notifications with errors", async () => {
    const notification: NotificationData = {
      type: "ingestion",
      filename: "doc.pdf",
      status: "failed",
      error: "Processing failed",
    };

    await notify(notification);
    const messages = await pollNotifications(0, 0.1);

    expect(messages).toHaveLength(1);
    expect(messages[0].data.status).toBe("failed");
    expect(messages[0].data.error).toBe("Processing failed");
  });

  it("should limit queue size after many messages", async () => {
    const message: NotificationData = {
      type: "ingestion",
      status: "completed",
    };

    for (let i = 0; i < 1001; i++) {
      await notify(message);
    }

    const allMessages = await pollNotifications(0, 0.1);

    expect(allMessages.length).toBeLessThanOrEqual(1000);
  });

  it("should return status ok from notify", async () => {
    const notification: NotificationData = {
      type: "ingestion",
      filename: "test.pdf",
      status: "completed",
    };

    const result = await notify(notification);

    expect(result).toEqual({ status: "ok" });
  });

  it("should handle notifications with only required fields", async () => {
    const notification: NotificationData = {
      type: "ingestion",
      status: "completed",
    };

    const result = await notify(notification);

    expect(result).toEqual({ status: "ok" });
  });

  it("should preserve notification metadata", async () => {
    const notification: NotificationData = {
      type: "summarization",
      filename: "report.pdf",
      status: "completed",
      result: "This is a summary",
    };

    await notify(notification);
    const messages = await pollNotifications(0, 0.1);

    expect(messages[0].data.filename).toBe("report.pdf");
    expect(messages[0].data.result).toBe("This is a summary");
  });

  it("should handle rapid consecutive notifications", async () => {
    const message: NotificationData = {
      type: "ingestion",
      status: "completed",
    };

    const promises: Promise<{ status: string }>[] = [];
    for (let i = 0; i < 10; i++) {
      promises.push(notify(message));
    }

    await Promise.all(promises);
    const messages = await pollNotifications(0, 0.1);

    expect(messages).toHaveLength(10);
    expect(messages[0].id).toBe(1);
    expect(messages[9].id).toBe(10);
  });

  it("should not affect subsequent polls", async () => {
    const message: NotificationData = {
      type: "ingestion",
      status: "completed",
    };

    await notify(message);

    const poll1 = await pollNotifications(0, 0.1);
    const poll2 = await pollNotifications(0, 0.1);
    const poll3 = await pollNotifications(1, 0.1);

    expect(poll1).toHaveLength(1);
    expect(poll2).toHaveLength(1);
    expect(poll3).toHaveLength(0);
  });
});
