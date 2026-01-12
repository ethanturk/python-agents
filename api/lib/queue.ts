/**
 * Queue service HTTP client.
 * Provides HTTP interface to the external queue service.
 */

import type { TaskResponse } from "./types";
import { config } from "./config";
import logger from "./logger";

// Mock implementation for local development
class MockQueueService {
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

// Real HTTP implementation
class HttpQueueService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.QUEUE_SERVICE_URL || "http://localhost:8000";
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

// Initialize queue service based on provider
let queueService: MockQueueService | HttpQueueService | null = null;

export function initQueueService(): MockQueueService | HttpQueueService {
  if (queueService !== null) {
    return queueService;
  }

  const provider = config.QUEUE_PROVIDER || "mock";

  if (provider === "mock") {
    logger.info("Using mock queue service");
    queueService = new MockQueueService();
  } else if (
    provider === "http" ||
    provider === "sqs" ||
    provider === "azure"
  ) {
    logger.info(`Using HTTP queue service (provider: ${provider})`);
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

export { MockQueueService, HttpQueueService };
