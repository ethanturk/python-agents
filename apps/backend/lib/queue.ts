/**
 * Queue service for async task processing.
 * Supports Azure Storage Queue, HTTP proxy, and mock implementations.
 */

import type { TaskResponse } from "./types.js";
import logger from "./logger.js";
import { randomUUID } from "crypto";

// Base interface for queue services
interface IQueueService {
  submitTask(
    taskType: string,
    payload: Record<string, unknown>,
  ): Promise<string>;
  getTaskStatus(taskId: string): Promise<{ status: string; result: unknown }>;
}

// Mock implementation for local development
class MockQueueService implements IQueueService {
  private tasks = new Map<string, { status: string; result: unknown }>();
  private counter = 0;

  async submitTask(
    taskType: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    this.counter++;
    const taskId = `mock-task-${this.counter}`;

    this.tasks.set(taskId, {
      status: "pending",
      result: null,
    });

    logger.info({ taskId, taskType, payload }, "Mock queue: Task submitted");

    // Simulate task completion after delay
    setTimeout(() => {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = "completed";
        task.result = `Mock result for ${taskType}`;
      }
    }, 1000);

    return taskId;
  }

  async getTaskStatus(
    taskId: string,
  ): Promise<{ status: string; result: unknown }> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return task;
  }
}

// HTTP proxy implementation (calls external queue service)
class HttpQueueService implements IQueueService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.QUEUE_SERVICE_URL || "http://localhost:8000";
  }

  async submitTask(
    taskType: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/queue/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_type: taskType,
          payload,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Queue service error: ${error}`);
      }

      const data = (await response.json()) as { task_id: string };
      return data.task_id;
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, "Queue service submit task error");
      throw err;
    }
  }

  async getTaskStatus(
    taskId: string,
  ): Promise<{ status: string; result: unknown }> {
    try {
      const response = await fetch(`${this.baseUrl}/queue/status/${taskId}`, {
        method: "GET",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Queue service error: ${error}`);
      }

      return (await response.json()) as { status: string; result: unknown };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, "Queue service get status error");
      throw err;
    }
  }
}

// Azure Storage Queue implementation
class AzureQueueService implements IQueueService {
  private connectionString: string;
  private queueName: string;
  private webhookUrl: string;
  private queueEnsured = false;

  constructor() {
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
    const clientId = (process.env.CLIENT_ID || "default").toLowerCase();
    this.queueName = `${clientId}-tasks`;

    // Webhook URL for worker to notify on completion
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.API_URL || "http://localhost:3001";
    this.webhookUrl = `${baseUrl}/api/notifications/internal/notify`;

    if (!this.connectionString) {
      logger.warn("AZURE_STORAGE_CONNECTION_STRING not configured");
    }

    logger.info(
      { queueName: this.queueName },
      "AzureQueueService initialized",
    );
  }

  private async ensureQueueExists(): Promise<void> {
    if (this.queueEnsured || !this.connectionString) {
      return;
    }

    try {
      // Dynamic import to avoid bundling issues in serverless
      const { QueueServiceClient } = await import("@azure/storage-queue");

      const queueServiceClient = QueueServiceClient.fromConnectionString(
        this.connectionString,
      );
      const queueClient = queueServiceClient.getQueueClient(this.queueName);

      // Create queue if it doesn't exist
      await queueClient.createIfNotExists();
      this.queueEnsured = true;
      logger.info({ queueName: this.queueName }, "Queue ensured to exist");
    } catch (error) {
      const err = error as Error;
      logger.error(
        { error: err.message, queueName: this.queueName },
        "Failed to ensure queue exists",
      );
      throw err;
    }
  }

  async submitTask(
    taskType: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    if (!this.connectionString) {
      throw new Error("Azure Queue not configured");
    }

    await this.ensureQueueExists();

    try {
      const { QueueServiceClient } = await import("@azure/storage-queue");

      const queueServiceClient = QueueServiceClient.fromConnectionString(
        this.connectionString,
      );
      const queueClient = queueServiceClient.getQueueClient(this.queueName);

      const taskId = randomUUID();
      const message = JSON.stringify({
        task_type: taskType,
        task_id: taskId,
        payload,
        webhook_url: this.webhookUrl,
      });

      // Azure Queue message format: taskId|jsonPayload
      await queueClient.sendMessage(Buffer.from(message).toString("base64"));

      logger.info(
        { taskId, taskType, queueName: this.queueName },
        "Task submitted to Azure Queue",
      );

      return taskId;
    } catch (error) {
      const err = error as Error;
      logger.error(
        { error: err.message, taskType },
        "Failed to submit task to Azure Queue",
      );
      throw err;
    }
  }

  async getTaskStatus(
    taskId: string,
  ): Promise<{ status: string; result: unknown }> {
    // Azure Queue doesn't track task status - that's handled via webhooks
    // Return pending status; actual status comes from notifications table
    return {
      status: "pending",
      result: null,
    };
  }
}

// Initialize queue service based on provider
let queueService: IQueueService | null = null;

export function initQueueService(): IQueueService {
  if (queueService !== null) {
    return queueService;
  }

  const provider = process.env.QUEUE_PROVIDER || "mock";

  if (provider === "mock") {
    logger.info("Using mock queue service");
    queueService = new MockQueueService();
  } else if (provider === "azure") {
    logger.info("Using Azure Queue service");
    queueService = new AzureQueueService();
  } else if (provider === "http") {
    logger.info("Using HTTP queue service");
    queueService = new HttpQueueService();
  } else {
    logger.warn(`Unknown queue provider: ${provider}, falling back to mock`);
    queueService = new MockQueueService();
  }

  return queueService;
}

/**
 * Submit a task to the queue service.
 * @param taskType - Type of task (e.g., "agent_async", "ingest_docs")
 * @param payload - Task payload
 * @returns Task ID
 */
export async function submitTask(
  taskType: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const queue = initQueueService();
  return queue.submitTask(taskType, payload);
}

/**
 * Get task status from queue service.
 * @param taskId - Task ID
 * @returns Task status and result
 */
export async function getTaskStatus(taskId: string): Promise<TaskResponse> {
  const queue = initQueueService();
  const status = await queue.getTaskStatus(taskId);

  return {
    task_id: taskId,
    status:
      (status.status as "pending" | "processing" | "completed" | "failed") ||
      "pending",
    result: status.result,
  };
}

export { MockQueueService, HttpQueueService, AzureQueueService };
