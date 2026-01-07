import { render, screen } from "@testing-library/react";
import App from "./App";
import { describe, it, expect, vi } from "vitest";

vi.mock("./hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { email: "test@test.com" } }),
}));

vi.mock("./hooks/useDocumentSet", () => ({
  useDocumentSet: () => ({
    selectedSet: "all",
    documentSets: [],
    fetchDocumentSets: vi.fn(),
  }),
}));

vi.mock("./hooks/useWebSocket", () => ({
  default: () => ({ isConnected: true }),
}));

vi.mock("./hooks/useDocuments", () => ({
  default: () => ({
    groupedDocs: {},
    loading: false,
    fetchDocuments: vi.fn(),
    ensureDocsLoaded: vi.fn(),
    deleteDialogOpen: false,
    docToDelete: null,
    handlePromptDelete: vi.fn(),
    confirmDelete: vi.fn(),
    setDeleteDialogOpen: vi.fn(),
  }),
}));

vi.mock("./hooks/useSearch", () => ({
  default: () => ({
    query: "",
    setQuery: vi.fn(),
    searchData: { results: [] },
    searchLimit: 10,
    setSearchLimit: vi.fn(),
    loading: false,
    searchChatHistory: [],
    searchChatLoading: false,
    validationError: null,
    handleSearch: vi.fn(),
    handleSendSearchChat: vi.fn(),
  }),
}));

vi.mock("./hooks/useSummarization", () => ({
  default: () => ({
    selectedDoc: "",
    setSelectedDoc: vi.fn(),
    summaryResult: null,
    setSummaryResult: vi.fn(),
    chatHistory: [],
    chatLoading: false,
    isSummarizing: false,
    activeSummaries: [],
    setActiveSummaries: vi.fn(),
    notifications: [],
    unreadCount: 0,
    cachedSummaries: {},
    handleSummarizeRequest: vi.fn(),
    handleSendChat: vi.fn(),
    handleSelectCachedSummary: vi.fn(),
    handleDeleteCachedSummary: vi.fn(),
    handleNewNotification: vi.fn(),
    handleNotificationClick: vi.fn(),
    fetchBackendSummaries: vi.fn(),
  }),
}));

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByText("AI Doc Search")).toBeInTheDocument();
  });
});
