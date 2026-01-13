/**
 * Unit tests for Documents API (api/documents/index.ts)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "./index.js";
import * as supabaseModule from "../../lib/supabase.js";
import * as azureModule from "../../lib/azure.js";
import * as queueModule from "../../lib/queue.js";

// Mock modules
vi.mock("../lib/supabase.js", () => ({
  getDocuments: vi.fn(),
  getDocumentSets: vi.fn(),
  deleteDocuments: vi.fn(),
}));

vi.mock("../lib/azure.js", () => ({
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock("../lib/queue.js", () => ({
  submitTask: vi.fn(),
}));

describe("Documents API - Unit Tests", () => {
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
      const data = (await response.json()) as { status: "ok" };

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "ok" });
    });

    it("should return ok status from /documents/health", async () => {
      const request = new Request("http://localhost/documents/health");
      const response = await handler(request, {});
      const data = (await response.json()) as { status: "ok" };

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "ok" });
    });
  });

  describe("Get documents endpoint", () => {
    it("should return documents for specified document_set", async () => {
      const mockResults = [
        {
          filename: "doc1.pdf",
          document_set: "research",
          content: "",
          similarity: 0,
          chunk_count: 5,
        },
        {
          filename: "doc2.pdf",
          document_set: "research",
          content: "",
          similarity: 0,
          chunk_count: 3,
        },
      ];
      vi.mocked(supabaseModule.getDocuments).mockResolvedValue(mockResults);

      const request = new Request(
        "http://localhost/agent/documents?document_set=research",
      );
      const response = await handler(request, {});
      const data = (await response.json()) as { documents: unknown[] };

      expect(supabaseModule.getDocuments).toHaveBeenCalledWith("research");
      expect(data.documents).toHaveLength(2);
      expect(data.documents[0].filename).toBe("doc1.pdf");
      expect(data.documents[0].chunk_count).toBe(5);
    });

    it("should return documents for all document sets by default", async () => {
      const mockResults = [
        {
          filename: "doc.pdf",
          document_set: "default",
          content: "",
          similarity: 0,
          chunk_count: 1,
        },
      ];
      vi.mocked(supabaseModule.getDocuments).mockResolvedValue(mockResults);

      const request = new Request("http://localhost/agent/documents");
      await handler(request, {});

      expect(supabaseModule.getDocuments).toHaveBeenCalledWith("all");
    });

    it("should return empty array if no documents", async () => {
      vi.mocked(supabaseModule.getDocuments).mockResolvedValue([]);

      const request = new Request("http://localhost/agent/documents");
      const response = await handler(request, {});
      const data = (await response.json()) as { documents: unknown[] };

      expect(data.documents).toEqual([]);
    });

    it("should return 500 on database error", async () => {
      vi.mocked(supabaseModule.getDocuments).mockRejectedValue(
        new Error("Database error"),
      );

      const request = new Request("http://localhost/agent/documents");
      const response = await handler(request, {});
      const data = (await response.json()) as { detail: string };

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Database error");
    });
  });

  describe("Get document sets endpoint", () => {
    it("should return all document sets", async () => {
      const mockSets = ["research", "default", "projects"];
      vi.mocked(supabaseModule.getDocumentSets).mockResolvedValue(mockSets);

      const request = new Request("http://localhost/agent/documentsets");
      const response = await handler(request, {});
      const data = (await response.json()) as { document_sets: unknown[] };

      expect(supabaseModule.getDocumentSets).toHaveBeenCalled();
      expect(data.document_sets).toEqual(mockSets);
    });

    it("should return empty array if no document sets", async () => {
      vi.mocked(supabaseModule.getDocumentSets).mockResolvedValue([]);

      const request = new Request("http://localhost/agent/documentsets");
      const response = await handler(request, {});
      const data = (await response.json()) as { document_sets: unknown[] };

      expect(data.document_sets).toEqual([]);
    });

    it("should return 500 on database error", async () => {
      vi.mocked(supabaseModule.getDocumentSets).mockRejectedValue(
        new Error("Database error"),
      );

      const request = new Request("http://localhost/agent/documentsets");
      const response = await handler(request, {});
      const data = (await response.json()) as { detail: string };

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Database error");
    });
  });

  describe("Upload endpoint", () => {
    it("should upload files and submit ingestion tasks", async () => {
      const formData = new FormData();
      const file1 = new File(["content1"], "file1.pdf", {
        type: "application/pdf",
      });
      const file2 = new File(["content2"], "file2.pdf", {
        type: "application/pdf",
      });
      formData.append("file1", file1);
      formData.append("file2", file2);
      formData.append("document_set", "My Document Set");

      vi.mocked(azureModule.uploadFile).mockResolvedValue();
      vi.mocked(queueModule.submitTask).mockResolvedValue("task-1");

      const request = new Request("http://localhost/agent/upload", {
        method: "POST",
        body: formData,
      });
      const response = await handler(request, {});
      const data = (await response.json()) as {
        status: string;
        files_uploaded: number;
        document_set: string;
      };

      expect(azureModule.uploadFile).toHaveBeenCalledTimes(2);
      expect(azureModule.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining("file1.pdf"),
        expect.any(Buffer),
        "my_document_set",
      );
      expect(queueModule.submitTask).toHaveBeenCalledTimes(2);
      expect(data.status).toBe("ok");
      expect(data.files_uploaded).toBe(2);
      expect(data.document_set).toBe("my_document_set");
    });

    it("should sanitize document_set name", async () => {
      const formData = new FormData();
      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });
      formData.append("file", file);
      formData.append("document_set", "My Document Set @#$!");

      vi.mocked(azureModule.uploadFile).mockResolvedValue();
      vi.mocked(queueModule.submitTask).mockResolvedValue("task-1");

      const request = new Request("http://localhost/agent/upload", {
        method: "POST",
        body: formData,
      });
      const response = await handler(request, {});
      const data = (await response.json()) as { document_set: string };

      expect(data.document_set).toBe("my_document_set");
      expect(azureModule.uploadFile).toHaveBeenCalledWith(
        "test.pdf",
        expect.any(Buffer),
        "my_document_set",
      );
    });

    it("should handle single file upload", async () => {
      const formData = new FormData();
      const file = new File(["content"], "single.pdf", {
        type: "application/pdf",
      });
      formData.append("file", file);
      formData.append("document_set", "default");

      vi.mocked(azureModule.uploadFile).mockResolvedValue();
      vi.mocked(queueModule.submitTask).mockResolvedValue("task-1");

      const request = new Request("http://localhost/agent/upload", {
        method: "POST",
        body: formData,
      });
      const response = await handler(request, {});
      const data = (await response.json()) as { files_uploaded: number };

      expect(data.files_uploaded).toBe(1);
    });

    it("should return 500 if upload fails", async () => {
      const formData = new FormData();
      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });
      formData.append("file", file);
      formData.append("document_set", "default");

      vi.mocked(azureModule.uploadFile).mockRejectedValue(
        new Error("Storage error"),
      );

      const request = new Request("http://localhost/agent/upload", {
        method: "POST",
        body: formData,
      });
      const response = await handler(request, {});
      const data = (await response.json()) as { detail: string };

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Storage error");
    });
  });

  describe("Delete endpoint", () => {
    it("should delete file and documents", async () => {
      vi.mocked(azureModule.deleteFile).mockResolvedValue();
      vi.mocked(supabaseModule.deleteDocuments).mockResolvedValue(1);

      const request = new Request(
        "http://localhost/agent/documents/test.pdf?document_set=default",
        {
          method: "DELETE",
        },
      );
      const response = await handler(request, {});
      const data = (await response.json()) as { status: "ok" };

      expect(azureModule.deleteFile).toHaveBeenCalledWith(
        "test.pdf",
        "default",
      );
      expect(supabaseModule.deleteDocuments).toHaveBeenCalledWith(
        "test.pdf",
        "default",
      );
      expect(data).toEqual({ status: "ok" });
    });

    it("should delete from all document sets if not specified", async () => {
      vi.mocked(azureModule.deleteFile).mockResolvedValue();
      vi.mocked(supabaseModule.deleteDocuments).mockResolvedValue(1);

      const request = new Request("http://localhost/agent/documents/test.pdf", {
        method: "DELETE",
      });
      await handler(request, {});

      expect(azureModule.deleteFile).toHaveBeenCalledWith("test.pdf", "all");
      expect(supabaseModule.deleteDocuments).toHaveBeenCalledWith(
        "test.pdf",
        "all",
      );
    });

    it("should return 500 on delete error", async () => {
      vi.mocked(azureModule.deleteFile).mockRejectedValue(
        new Error("Delete failed"),
      );

      const request = new Request("http://localhost/agent/documents/test.pdf", {
        method: "DELETE",
      });
      const response = await handler(request, {});
      const data = (await response.json()) as { detail: string };

      expect(response.status).toBe(500);
      expect(data.detail).toBe("Delete failed");
    });
  });

  describe("File proxy endpoint", () => {
    it("should download and return file with correct content type", async () => {
      const mockBuffer = Buffer.from("file content");
      vi.mocked(azureModule.downloadFile).mockResolvedValue({
        buffer: mockBuffer,
        contentType: "application/pdf",
      });

      const request = new Request(
        "http://localhost/agent/files/default/test.pdf",
      );
      const response = await handler(request, {});

      expect(azureModule.downloadFile).toHaveBeenCalledWith(
        "test.pdf",
        "default",
      );
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Content-Disposition")).toContain(
        'filename="test.pdf"',
      );

      const responseBuffer = await response.arrayBuffer();
      expect(Buffer.from(responseBuffer)).toEqual(mockBuffer);
    });

    it("should handle files in subdirectories", async () => {
      const mockBuffer = Buffer.from("content");
      vi.mocked(azureModule.downloadFile).mockResolvedValue({
        buffer: mockBuffer,
        contentType: "text/plain",
      });

      const request = new Request(
        "http://localhost/agent/files/folder/subfolder/file.txt",
      );
      await handler(request, {});

      expect(azureModule.downloadFile).toHaveBeenCalledWith(
        "subfolder/file.txt",
        "folder",
      );
    });

    it("should return 500 on download error", async () => {
      vi.mocked(azureModule.downloadFile).mockRejectedValue(
        new Error("File not found"),
      );

      const request = new Request(
        "http://localhost/agent/files/default/test.pdf",
      );
      const response = await handler(request, {});
      const data = (await response.json()) as { detail: string };

      expect(response.status).toBe(500);
      expect(data.detail).toBe("File not found");
    });
  });

  describe("404 for unknown routes", () => {
    it("should return 404 for unknown paths", async () => {
      const request = new Request("http://localhost/unknown");
      const response = await handler(request, {});
      const data = (await response.json()) as { detail: string };

      expect(response.status).toBe(404);
      expect(data).toEqual({ detail: "Not found" });
    });
  });
});
