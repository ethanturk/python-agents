import { useState, useCallback } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { useDocumentSet } from "../contexts/DocumentSetContext";
import { SEARCH } from "@/constants";

interface SearchResult {
  metadata: {
    filename: string;
  };
}

interface SearchData {
  answer: string | null;
  results: SearchResult[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  searchData: SearchData;
  searchLimit: number;
  setSearchLimit: (limit: number) => void;
  loading: boolean;
  searchChatHistory: ChatMessage[];
  searchChatLoading: boolean;
  validationError: string;
  handleSearch: () => Promise<void>;
  handleSendSearchChat: (question: string) => Promise<void>;
}

export default function useSearch(): UseSearchReturn {
  const { selectedSet } = useDocumentSet();
  const [searchData, setSearchData] = useState<SearchData>({
    answer: null,
    results: [],
  });
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [searchLimit, setSearchLimit] = useState<number>(SEARCH.DEFAULT_LIMIT);
  const [searchChatHistory, setSearchChatHistory] = useState<ChatMessage[]>([]);
  const [searchChatLoading, setSearchChatLoading] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>("");

  const handleSearch = useCallback(async () => {
    if (!query || !query.trim()) {
      setValidationError("Please enter a search query");
      return;
    }

    if (query.trim().length < SEARCH.MIN_QUERY_LENGTH) {
      setValidationError(
        `Search query must be at least ${SEARCH.MIN_QUERY_LENGTH} characters`,
      );
      return;
    }

    setValidationError("");
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/agent/search`, {
        prompt: query,
        limit: searchLimit,
        document_set: selectedSet,
      });
      const data = response.data;
      setSearchChatHistory([]);
      if (data.answer) {
        setSearchData({ answer: data.answer, results: data.results || [] });
      } else {
        setSearchData({ answer: null, results: data.results || [] });
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  }, [query, searchLimit, selectedSet]);

  const handleSendSearchChat = useCallback(
    async (question: string) => {
      if (!searchData.results || searchData.results.length === 0) return;

      const newMsg: ChatMessage = { role: "user", text: question };
      setSearchChatHistory((prev) => [...prev, newMsg]);
      setSearchChatLoading(true);

      try {
        const res = await axios.post(`${API_BASE}/agent/search_qa`, {
          question: question,
          context_results: searchData.results,
        });
        const answerMsg: ChatMessage = {
          role: "assistant",
          text: res.data.answer,
        };
        setSearchChatHistory((prev) => [...prev, answerMsg]);
      } catch (error) {
        console.error("Search Chat error:", error);
        const errorMsg: ChatMessage = {
          role: "assistant",
          text: "Sorry, I encountered an error.",
        };
        setSearchChatHistory((prev) => [...prev, errorMsg]);
      } finally {
        setSearchChatLoading(false);
      }
    },
    [searchData.results],
  );

  return {
    query,
    setQuery,
    searchData,
    searchLimit,
    setSearchLimit,
    loading,
    searchChatHistory,
    searchChatLoading,
    validationError,
    handleSearch,
    handleSendSearchChat,
  };
}
