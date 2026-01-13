/**
 * Unit tests for Summaries API (api/summaries/index.ts)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "./index.js";
import * as llmModule from "../../lib/llm.js";
import * as dbModule from "../../lib/database.js";
import * as supabaseModule from "../../lib/supabase.js";
import * as queueModule from "../../lib/queue.js";

// Mock modules
vi.mock("../lib/llm.js", () => ({
  runQAAgent: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock("../lib/database.js", () => ({
  getAllSummaries: vi.fn(),
  getSummaryByFilename: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  matchDocuments: vi.fn(),
}));

vi.mock("../lib/queue.js", () => ({
  submitTask: vi.fn(),
}));

describe("Summaries API - Unit Tests", () => {
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

    it("should return ok status from /summaries/health", async () => {
      const request = new Request("http://localhost/summaries/health");
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "ok" });
    });
  });

  describe("Get all summaries endpoint", () => {
    it("should return all summaries", async () => {
      const mockSummaries = [
        {
          id: 1,
          filename: "doc1.pdf",
          summary: "Summary of doc1",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          filename: "doc2.pdf",
          summary: "Summary of doc2",
          created_at: "2024-01-02T00:00:00Z",
        },
      ];
      vi.mocked(dbModule.getAllSummaries).mockResolvedValue(mockSummaries);

      const request = new Request("http://localhost/agent/summaries");
      const response = await handler(request, {});
      const data = await response.json();

      expect(dbModule.getAllSummaries).toHaveBeenCalled();
      expect(data).toEqual({ summaries: mockSummaries });
    });

    it("should return empty array if no summaries", async () => {
      vi.mocked(dbModule.getAllSummaries).mockResolvedValue([]);

      const request = new Request("http://localhost/agent/summaries");
      const response = await handler(request, {});
      const data = await response.json();

      expect(data).toEqual({ summaries: [] });
    });

    it("should return 500 on database error", async () => {
      vi.mocked(dbModule.getAllSummaries).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const request = new Request("http://localhost/agent/summaries");
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Database connection failed");
    });
  });

  describe("Summary QA endpoint", () => {
    it("should return QA answer for existing summary", async () => {
      const mockSummary = {
        id: 1,
        filename: "test.pdf",
        summary: "This is a test summary about AI.",
        created_at: "2024-01-01T00:00:00Z",
      };
      const mockAnswer = "AI stands for Artificial Intelligence.";

      vi.mocked(dbModule.getSummaryByFilename).mockResolvedValue(mockSummary);
      vi.mocked(llmModule.runQAAgent).mockResolvedValue(mockAnswer);

      const request = new Request("http://localhost/agent/summary_qa", {
        method: "POST",
        body: JSON.stringify({
          filename: "test.pdf",
          question: "What does AI stand for?",
        }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(dbModule.getSummaryByFilename).toHaveBeenCalledWith("test.pdf");
      expect(llmModule.runQAAgent).toHaveBeenCalledWith(
        "What does AI stand for?",
        mockSummary.summary,
      );
      expect(data).toEqual({ response: mockAnswer });
    });

    it("should return 404 for non-existent summary", async () => {
      vi.mocked(dbModule.getSummaryByFilename).mockResolvedValue(null);

      const request = new Request("http://localhost/agent/summary_qa", {
        method: "POST",
        body: JSON.stringify({
          filename: "nonexistent.pdf",
          question: "Test question",
        }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ detail: "Summary not found" });
    });

    it("should return 500 on database error", async () => {
      vi.mocked(dbModule.getSummaryByFilename).mockRejectedValue(
        new Error("Database error"),
      );

      const request = new Request("http://localhost/agent/summary_qa", {
        method: "POST",
        body: JSON.stringify({
          filename: "test.pdf",
          question: "Test",
        }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Database error");
    });
  });

  describe("Search QA endpoint", () => {
    it("should return QA answer based on search results", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockSearchResults = [
        {
          content: "AI is a branch of computer science.",
          filename: "doc1.pdf",
          document_set: "default",
          similarity: 0.9,
        },
      ];
      const mockAnswer = "AI is a branch of computer science.";

      vi.mocked(llmModule.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(supabaseModule.matchDocuments).mockResolvedValue(
        mockSearchResults,
      );
      vi.mocked(llmModule.runQAAgent).mockResolvedValue(mockAnswer);

      const request = new Request("http://localhost/agent/search_qa", {
        method: "POST",
        body: JSON.stringify({
          question: "What is AI?",
          document_set: "default",
        }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(llmModule.generateEmbedding).toHaveBeenCalledWith("What is AI?");
      expect(supabaseModule.matchDocuments).toHaveBeenCalledWith(
        mockEmbedding,
        0.7,
        10,
        "default",
      );
      expect(data).toEqual({ response: mockAnswer });
    });

    it("should use default document_set if not provided", async () => {
      const mockEmbedding = [0.1];
      vi.mocked(llmModule.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(supabaseModule.matchDocuments).mockResolvedValue([]);
      vi.mocked(llmModule.runQAAgent).mockResolvedValue("Answer");

      const request = new Request("http://localhost/agent/search_qa", {
        method: "POST",
        body: JSON.stringify({ question: "Test" }),
      });
      await handler(request, {});

      expect(supabaseModule.matchDocuments).toHaveBeenCalledWith(
        mockEmbedding,
        0.7,
        10,
        "all",
      );
    });

    it("should return 500 if embedding generation fails", async () => {
      vi.mocked(llmModule.generateEmbedding).mockRejectedValue(
        new Error("Embedding error"),
      );

      const request = new Request("http://localhost/agent/search_qa", {
        method: "POST",
        body: JSON.stringify({ question: "Test" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Embedding error");
    });
  });

  describe("Summarize endpoint", () => {
    it("should submit summarization task and return task_id and webhook_url", async () => {
      const mockTaskId = "task-456";
      vi.mocked(queueModule.submitTask).mockResolvedValue(mockTaskId);

      const request = new Request("http://localhost/agent/summarize", {
        method: "POST",
        body: JSON.stringify({
          filename: "document.pdf",
          url: "https://example.com/webhook",
        }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(queueModule.submitTask).toHaveBeenCalledWith("summarize", {
        filename: "document.pdf",
        url: "https://example.com/webhook",
      });
      expect(data.task_id).toBe(mockTaskId);
      expect(data.webhook_url).toContain("/internal/notify");
    });

    it("should submit task without optional URL", async () => {
      const mockTaskId = "task-789";
      vi.mocked(queueModule.submitTask).mockResolvedValue(mockTaskId);

      const request = new Request("http://localhost/agent/summarize", {
        method: "POST",
        body: JSON.stringify({ filename: "doc.pdf" }),
      });
      await handler(request, {});

      expect(queueModule.submitTask).toHaveBeenCalledWith("summarize", {
        filename: "doc.pdf",
        url: undefined,
      });
    });

    it("should return 500 if task submission fails", async () => {
      vi.mocked(queueModule.submitTask).mockRejectedValue(
        new Error("Queue service down"),
      );

      const request = new Request("http://localhost/agent/summarize", {
        method: "POST",
        body: JSON.stringify({ filename: "test.pdf" }),
      });
      const response = await handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Queue service down");
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
