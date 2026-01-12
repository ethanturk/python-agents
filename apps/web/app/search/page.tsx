"use client";

import { useAuth } from "@/contexts/AuthContext";
import NavBar from "@/components/NavBar";
import SearchView from "@/components/SearchView";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_BASE } from "@/lib/config";
import { useDocumentSet } from "@/contexts/DocumentSetContext";

interface SearchResult {
  metadata: {
    filename: string;
  };
}

interface SearchData {
  answer?: string;
  results: SearchResult[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function SearchPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { selectedSet } = useDocumentSet();

  const [query, setQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(10);
  const [searchData, setSearchData] = useState<SearchData>({
    answer: "",
    results: [],
  });
  const [loading, setLoading] = useState(false);
  const [searchChatHistory, setSearchChatHistory] = useState<ChatMessage[]>([]);
  const [searchChatLoading, setSearchChatLoading] = useState(false);
  const [validationError, setValidationError] = useState<string>();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, authLoading, router]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setValidationError("Please enter a search query");
      return;
    }

    setValidationError(undefined);
    setLoading(true);
    setSearchChatHistory([]);

    try {
      const token = currentUser ? await currentUser.getIdToken() : "";
      const response = await axios.post(
        `${API_BASE}/agent/search`,
        {
          query: query,
          k: searchLimit,
          document_set: selectedSet,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setSearchData(response.data);
    } catch (error) {
      console.error("Search error:", error);
      setSearchData({
        answer: "An error occurred during search.",
        results: [],
      });
    } finally {
      setLoading(false);
    }
  }, [query, searchLimit, selectedSet, currentUser]);

  const handleSendSearchChat = useCallback(
    async (message: string) => {
      if (!message.trim() || !searchData.results.length) return;

      const userMessage: ChatMessage = { role: "user", text: message };
      setSearchChatHistory((prev) => [...prev, userMessage]);
      setSearchChatLoading(true);

      try {
        const token = currentUser ? await currentUser.getIdToken() : "";
        const response = await axios.post(
          `${API_BASE}/agent/qa`,
          {
            query: message,
            results: searchData.results,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const assistantMessage: ChatMessage = {
          role: "assistant",
          text: response.data.answer || "No answer available.",
        };
        setSearchChatHistory((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Chat error:", error);
        const errorMessage: ChatMessage = {
          role: "assistant",
          text: "An error occurred while processing your question.",
        };
        setSearchChatHistory((prev) => [...prev, errorMessage]);
      } finally {
        setSearchChatLoading(false);
      }
    },
    [searchData.results, currentUser],
  );

  if (authLoading || !currentUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="container mx-auto px-4 py-8">
        <SearchView
          query={query}
          setQuery={setQuery}
          onSearch={handleSearch}
          searchData={searchData}
          searchLimit={searchLimit}
          setSearchLimit={setSearchLimit}
          loading={loading}
          searchChatHistory={searchChatHistory}
          onSendSearchChat={handleSendSearchChat}
          searchChatLoading={searchChatLoading}
          validationError={validationError}
        />
      </main>
    </div>
  );
}
