import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { useDocumentSet } from '../contexts/DocumentSetContext';

export default function useSearch() {
  const { selectedSet } = useDocumentSet();
  const [searchData, setSearchData] = useState({ answer: null, results: [] });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLimit, setSearchLimit] = useState(10);
  const [searchChatHistory, setSearchChatHistory] = useState([]);
  const [searchChatLoading, setSearchChatLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/agent/search`, { 
        prompt: query, 
        limit: searchLimit,
        document_set: selectedSet
      });
      const data = response.data;
      setSearchChatHistory([]); // Reset chat on new search
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

  const handleSendSearchChat = useCallback(async (question) => {
    if (!searchData.results || searchData.results.length === 0) return;

    const newMsg = { role: 'user', text: question };
    setSearchChatHistory(prev => [...prev, newMsg]);
    setSearchChatLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/agent/search_qa`, {
        question: question,
        context_results: searchData.results
      });
      const answerMsg = { role: 'ai', text: res.data.answer };
      setSearchChatHistory(prev => [...prev, answerMsg]);
    } catch (error) {
      console.error("Search Chat error:", error);
      const errorMsg = { role: 'ai', text: "Sorry, I encountered an error." };
      setSearchChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setSearchChatLoading(false);
    }
  }, [searchData.results]);

  return {
    query,
    setQuery,
    searchData,
    searchLimit,
    setSearchLimit,
    loading,
    searchChatHistory,
    searchChatLoading,
    handleSearch,
    handleSendSearchChat
  };
}
