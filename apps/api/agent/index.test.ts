/**
 * Unit tests for Agent API (api/agent/index.ts)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "./index.js";
import * as llmModule from "../lib/llm.js";
import * as supabaseModule from "../lib/supabase.js";
import * as queueModule from "../lib/queue.js";

// Mock modules
vi.mock("../lib/llm.js", () => ({
  runSyncAgent: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  matchDocuments: vi.fn(),
}));

vi.mock("../lib/queue.js", () => ({
  submitTask: vi.fn(),
  getTaskStatus: vi.fn(),
}));

describe("Agent API - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Health endpoint", () => {
    it("should return ok status", async () => {
      const request = new Request("http://localhost/health");
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "ok" });
    });

    it("should return ok status from /agent/health", async () => {
      const request = new Request("http://localhost/agent/health");
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "ok" });
    });
  });

  describe("Sync agent endpoint", () => {
    it("should call runSyncAgent and return response", async () => {
      const mockResponse = "This is a test response";
      vi.mocked(llmModule.runSyncAgent).mockResolvedValue(mockResponse);

      const request = new Request("http://localhost/agent/sync", {
        method: "POST",
        body: JSON.stringify({ prompt: "What is AI?" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(llmModule.runSyncAgent).toHaveBeenCalledWith("What is AI?");
      expect(data).toEqual({ response: mockResponse });
    });

    it("should return error message if LLM fails", async () => {
      const errorMessage = "Error: API key not found";
      vi.mocked(llmModule.runSyncAgent).mockResolvedValue(errorMessage);

      const request = new Request("http://localhost/agent/sync", {
        method: "POST",
        body: JSON.stringify({ prompt: "Test" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(data).toEqual({ response: errorMessage });
    });

    it("should return 500 on unexpected error", async () => {
      vi.mocked(llmModule.runSyncAgent).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const request = new Request("http://localhost/agent/sync", {
        method: "POST",
        body: JSON.stringify({ prompt: "Test" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Unexpected error");
    });
  });

  describe("Async agent endpoint", () => {
    it("should submit task and return task_id", async () => {
      const mockTaskId = "task-123";
      vi.mocked(queueModule.submitTask).mockResolvedValue(mockTaskId);

      const request = new Request("http://localhost/agent/async", {
        method: "POST",
        body: JSON.stringify({ prompt: "What is AI?" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(queueModule.submitTask).toHaveBeenCalledWith("agent_async", {
        prompt: "What is AI?",
      });
      expect(data).toEqual({ task_id: mockTaskId });
    });

    it("should return 500 if queue submission fails", async () => {
      vi.mocked(queueModule.submitTask).mockRejectedValue(
        new Error("Queue service unavailable"),
      );

      const request = new Request("http://localhost/agent/async", {
        method: "POST",
        body: JSON.stringify({ prompt: "Test" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Queue service unavailable");
    });
  });

  describe("Agent status endpoint", () => {
    it("should return task status", async () => {
      const mockStatus = {
        task_id: "task-123",
        status: "completed" as const,
        result: "Task completed",
      };
      vi.mocked(queueModule.getTaskStatus).mockResolvedValue(mockStatus);

      const request = new Request("http://localhost/agent/status/task-123");
      const response = await handler(request, {});
      const data = await response.json();

      expect(queueModule.getTaskStatus).toHaveBeenCalledWith("task-123");
      expect(data).toEqual(mockStatus);
    });

    it("should return 404 for invalid task ID path", async () => {
      const request = new Request("http://localhost/agent/status/");
      const response = await handler(request, {});

      expect(response.status).toBe(404);
    });
  });

  describe("Search endpoint (RAG)", () => {
    it("should generate embedding and return search results", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockResults = [
        {
          content: "Test content",
          filename: "test.pdf",
          document_set: "default",
          similarity: 0.85,
          metadata: {},
        },
      ];

      vi.mocked(llmModule.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(supabaseModule.matchDocuments).mockResolvedValue(mockResults);

      const request = new Request("http://localhost/agent/search", {
        method: "POST",
        body: JSON.stringify({ prompt: "What is machine learning?" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(llmModule.generateEmbedding).toHaveBeenCalledWith(
        "What is machine learning?",
      );
      expect(supabaseModule.matchDocuments).toHaveBeenCalledWith(
        mockEmbedding,
        0.7,
        10,
        "all",
      );
      expect(data).toEqual(mockResults);
    });

    it("should use custom limit and document_set parameters", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      vi.mocked(llmModule.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(supabaseModule.matchDocuments).mockResolvedValue([]);

      const request = new Request("http://localhost/agent/search", {
        method: "POST",
        body: JSON.stringify({
          prompt: "Test query",
          limit: 5,
          document_set: "research",
        }),
      });
      await handler(request, {});

      expect(supabaseModule.matchDocuments).toHaveBeenCalledWith(
        mockEmbedding,
        0.7,
        5,
        "research",
      );
    });

    it("should return 500 if embedding generation fails", async () => {
      vi.mocked(llmModule.generateEmbedding).mockRejectedValue(
        new Error("Embedding API error"),
      );

      const request = new Request("http://localhost/agent/search", {
        method: "POST",
        body: JSON.stringify({ prompt: "Test" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Embedding API error");
    });

    it("should return 500 if Supabase search fails", async () => {
      const mockEmbedding = [0.1, 0.2];
      vi.mocked(llmModule.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(supabaseModule.matchDocuments).mockRejectedValue(
        new Error("Database error"),
      );

      const request = new Request("http://localhost/agent/search", {
        method: "POST",
        body: JSON.stringify({ prompt: "Test" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Database error");
    });
  });

  describe("404 for unknown routes", () => {
    it("should return 404 for unknown paths", async () => {
      const request = new Request("http://localhost/unknown");
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ detail: "Not found" });
    });
  });
});
