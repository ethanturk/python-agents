import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const STORAGE_KEY = 'summarization_cache_v2';
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

export default function useSummarization({ onShowSnackbar }) {
  // Summarize Result State
  const [selectedDoc, setSelectedDoc] = useState('');
  const [summaryResult, setSummaryResult] = useState(null);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Active Request State
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeSummaries, setActiveSummaries] = useState([]);

  // Notifications State (Owned here because it relates to summaries)
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Persistence State
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [cachedSummaries, setCachedSummaries] = useState({});

  // --- Load from Local Storage on Mount ---
  useEffect(() => {
    const loadStorage = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          const now = new Date().getTime();
          const validCache = {};
          const initialNotifications = [];

          if (data.cache) {
            Object.entries(data.cache).forEach(([key, value]) => {
              if (now - value.timestamp < EXPIRY_TIME) {
                validCache[key] = value;
                initialNotifications.push({
                  filename: key,
                  result: value.summaryResult || "No text",
                  status: 'completed',
                  read: true,
                  timestamp: value.timestamp
                });
              }
            });
          }

          setCachedSummaries(validCache);
          initialNotifications.sort((a, b) => b.timestamp - a.timestamp);
          setNotifications(initialNotifications);

          if (data.lastActiveDoc && validCache[data.lastActiveDoc]) {
            const entry = validCache[data.lastActiveDoc];
            setSelectedDoc(data.lastActiveDoc);
            setSummaryResult(entry.summaryResult);
            setChatHistory(entry.chatHistory || []);
          }
        }
      } catch (e) {
        console.error("Failed to load summarization cache", e);
      } finally {
        setStorageLoaded(true);
      }
    };
    loadStorage();
  }, []);

  // --- Update Cache when state changes ---
  useEffect(() => {
    if (!storageLoaded) return;
    if (selectedDoc && summaryResult) {
      setCachedSummaries(prev => ({
        ...prev,
        [selectedDoc]: {
          summaryResult,
          chatHistory,
          timestamp: new Date().getTime()
        }
      }));
    }
  }, [selectedDoc, summaryResult, chatHistory, storageLoaded]);

  // --- Persist Cache ---
  useEffect(() => {
    if (!storageLoaded) return;
    const stateToSave = {
      lastActiveDoc: selectedDoc,
      cache: cachedSummaries
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [cachedSummaries, selectedDoc, storageLoaded]);


  // --- Actions ---

  const handleSelectCachedSummary = useCallback((filename) => {
    const entry = cachedSummaries[filename];
    if (entry) {
      setSelectedDoc(filename);
      setSummaryResult(entry.summaryResult);
      setChatHistory(entry.chatHistory || []);
      return true; // Signal to switch view
    }
    return false;
  }, [cachedSummaries]);

  const handleDeleteCachedSummary = useCallback((filename) => {
    if (selectedDoc === filename) {
      setSelectedDoc('');
      setSummaryResult(null);
      setChatHistory([]);
    }
    setCachedSummaries(prev => {
        const newCache = { ...prev };
        delete newCache[filename];
        return newCache;
    });
    setNotifications(prev => prev.filter(n => n.filename !== filename));
  }, [selectedDoc]);

  const handleSummarizeRequest = useCallback(async (filename) => {
    setIsSummarizing(true);
    setSummaryResult(null);
    setChatHistory([]);
    try {
      await axios.post(`${API_BASE}/agent/summarize`, { filename });
      if (onShowSnackbar) onShowSnackbar("Summarization started. You will be notified when ready.");
      setActiveSummaries(prev => [...prev, filename]);

      setTimeout(() => {
        setActiveSummaries(prev => {
          if (prev.includes(filename)) {
            if (onShowSnackbar) onShowSnackbar(`Summary request for ${filename} timed out.`);
            return prev.filter(f => f !== filename);
          }
          return prev;
        });
      }, 5 * 60 * 1000); // 5m timeout

    } catch (error) {
      console.error("Error summarizing:", error);
      alert("Failed to start summarization");
    } finally {
      setIsSummarizing(false);
    }
  }, [onShowSnackbar]);

  const handleSendChat = useCallback(async (question) => {
    if (!selectedDoc) return;
    const newMsg = { role: 'user', text: question };
    setChatHistory(prev => [...prev, newMsg]);
    setChatLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/agent/summary_qa`, {
        filename: selectedDoc,
        question: question
      });
      const answerMsg = { role: 'ai', text: res.data.answer };
      setChatHistory(prev => [...prev, answerMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error." }]);
    } finally {
      setChatLoading(false);
    }
  }, [selectedDoc]);

  const handleNewNotification = useCallback((notif) => {
    setCachedSummaries(prev => ({
      ...prev,
      [notif.filename]: {
        summaryResult: notif.result,
        chatHistory: [],
        timestamp: new Date().getTime()
      }
    }));
    setNotifications(prev => [{ ...notif, read: false, timestamp: new Date() }, ...prev]);
    setUnreadCount(prev => prev + 1);
    if (onShowSnackbar) onShowSnackbar(`Summary ready for ${notif.filename}`);
  }, [onShowSnackbar]);

  const handleNotificationClick = useCallback((notif) => {
    setNotifications(prev => prev.map(n => n === notif ? { ...n, read: true } : n));
    if (!notif.read) setUnreadCount(prev => Math.max(0, prev - 1));

    setSelectedDoc(notif.filename);

    if ((!notif.result || notif.result === "No text") && cachedSummaries[notif.filename]) {
      const entry = cachedSummaries[notif.filename];
      setSummaryResult(entry.summaryResult);
      setChatHistory(entry.chatHistory || []);
    } else {
      setSummaryResult(notif.result);
      setChatHistory([]); 
    }
    return true; // Signal to switch to summarize view
  }, [cachedSummaries]);

  // Fetch initial history from backend (merging with local cache)
  const fetchBackendSummaries = useCallback(async () => {
    try {
        const res = await axios.get(`${API_BASE}/agent/summaries`);
        const history = res.data.summaries.map(s => ({
          filename: s.filename,
          result: s.summary_text || "No text",
          status: 'completed',
          read: true,
          timestamp: s.created_at
        }));
        setNotifications(prev => {
          const existingFiles = new Set(prev.map(p => p.filename));
          const newItems = history.filter(h => !existingFiles.has(h.filename));
          return [...prev, ...newItems];
        });
    } catch (error) {
        console.error("Failed to load summary history", error);
    }
  }, []);

  return {
    selectedDoc, setSelectedDoc,
    summaryResult, setSummaryResult,
    chatHistory, chatLoading,
    isSummarizing, activeSummaries, setActiveSummaries,
    notifications, unreadCount,
    cachedSummaries,
    handleSummarizeRequest,
    handleSendChat,
    handleSelectCachedSummary,
    handleDeleteCachedSummary,
    handleNewNotification,
    handleNotificationClick,
    fetchBackendSummaries
  };
}
