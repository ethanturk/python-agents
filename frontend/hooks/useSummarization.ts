import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE } from "@/lib/config";
import { STORAGE_KEYS, SUMMARIZATION } from "@/constants";

const STORAGE_KEY = STORAGE_KEYS.SUMMARIZATION_STATE;

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface CachedSummary {
  summaryResult?: string;
  chatHistory?: ChatMessage[];
  timestamp: number;
}

interface Notification {
  filename: string;
  result?: string;
  status: string;
  read: boolean;
  timestamp: number;
}

interface UseSummarizationProps {
  onShowSnackbar?: (message: string) => void;
}

interface UseSummarizationReturn {
  selectedDoc: string;
  setSelectedDoc: (doc: string) => void;
  summaryResult: string | null;
  setSummaryResult: (result: string | null) => void;
  chatHistory: ChatMessage[];
  chatLoading: boolean;
  isSummarizing: boolean;
  activeSummaries: string[];
  setActiveSummaries: React.Dispatch<React.SetStateAction<string[]>>;
  notifications: Notification[];
  unreadCount: number;
  cachedSummaries: Record<string, CachedSummary>;
  handleSummarizeRequest: (filename: string) => Promise<void>;
  handleSendChat: (question: string) => Promise<void>;
  handleSelectCachedSummary: (filename: string) => boolean;
  handleDeleteCachedSummary: (filename: string) => void;
  handleNewNotification: (notif: Notification) => void;
  handleNotificationClick: (notif: Notification) => boolean;
  fetchBackendSummaries: () => Promise<void>;
}

interface StorageData {
  lastActiveDoc?: string;
  cache?: Record<string, CachedSummary>;
}

export default function useSummarization({
  onShowSnackbar,
}: UseSummarizationProps): UseSummarizationReturn {
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [activeSummaries, setActiveSummaries] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [storageLoaded, setStorageLoaded] = useState<boolean>(false);
  const [cachedSummaries, setCachedSummaries] = useState<
    Record<string, CachedSummary>
  >({});

  useEffect(() => {
    const loadStorage = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data: StorageData = JSON.parse(stored);
          const now = new Date().getTime();
          const validCache: Record<string, CachedSummary> = {};
          const initialNotifications: Notification[] = [];

          if (data.cache) {
            Object.entries(data.cache).forEach(([key, value]) => {
              if (now - value.timestamp < SUMMARIZATION.CACHE_EXPIRY_TIME) {
                validCache[key] = value;
                initialNotifications.push({
                  filename: key,
                  result: value.summaryResult || "No text",
                  status: "completed",
                  read: true,
                  timestamp: value.timestamp,
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
            setSummaryResult(entry.summaryResult || null);
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

  useEffect(() => {
    if (!storageLoaded) return;
    if (selectedDoc && summaryResult) {
      setCachedSummaries((prev) => ({
        ...prev,
        [selectedDoc]: {
          summaryResult,
          chatHistory,
          timestamp: new Date().getTime(),
        },
      }));
    }
  }, [selectedDoc, summaryResult, chatHistory, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    const stateToSave: StorageData = {
      lastActiveDoc: selectedDoc,
      cache: cachedSummaries,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [cachedSummaries, selectedDoc, storageLoaded]);

  const handleSelectCachedSummary = useCallback(
    (filename: string): boolean => {
      const entry = cachedSummaries[filename];
      if (entry) {
        setSelectedDoc(filename);
        setSummaryResult(entry.summaryResult || null);
        setChatHistory(entry.chatHistory || []);
        return true;
      }
      return false;
    },
    [cachedSummaries],
  );

  const handleDeleteCachedSummary = useCallback(
    (filename: string) => {
      if (selectedDoc === filename) {
        setSelectedDoc("");
        setSummaryResult(null);
        setChatHistory([]);
      }
      setCachedSummaries((prev) => {
        const newCache = { ...prev };
        delete newCache[filename];
        return newCache;
      });
      setNotifications((prev) => prev.filter((n) => n.filename !== filename));
    },
    [selectedDoc],
  );

  const handleSummarizeRequest = useCallback(
    async (filename: string) => {
      setIsSummarizing(true);
      setSummaryResult(null);
      setChatHistory([]);
      try {
        await axios.post(`${API_BASE}/agent/summarize`, { filename });
        if (onShowSnackbar) {
          onShowSnackbar(
            "Summarization started. You will be notified when ready.",
          );
        }
        setActiveSummaries((prev) => [...prev, filename]);

        setTimeout(() => {
          setActiveSummaries((prev) => {
            if (prev.includes(filename)) {
              if (onShowSnackbar) {
                onShowSnackbar(`Summary request for ${filename} timed out.`);
              }
              return prev.filter((f) => f !== filename);
            }
            return prev;
          });
        }, SUMMARIZATION.REQUEST_TIMEOUT);
      } catch (error) {
        console.error("Error summarizing:", error);
        alert("Failed to start summarization");
      } finally {
        setIsSummarizing(false);
      }
    },
    [onShowSnackbar],
  );

  const handleSendChat = useCallback(
    async (question: string) => {
      if (!selectedDoc) return;
      const newMsg: ChatMessage = { role: "user", text: question };
      setChatHistory((prev) => [...prev, newMsg]);
      setChatLoading(true);

      try {
        const res = await axios.post(`${API_BASE}/agent/summary_qa`, {
          filename: selectedDoc,
          question: question,
        });
        const answerMsg: ChatMessage = {
          role: "assistant",
          text: res.data.answer,
        };
        setChatHistory((prev) => [...prev, answerMsg]);
      } catch (error) {
        console.error("Chat error:", error);
        const errorMsg: ChatMessage = {
          role: "assistant",
          text: "Sorry, I encountered an error.",
        };
        setChatHistory((prev) => [...prev, errorMsg]);
      } finally {
        setChatLoading(false);
      }
    },
    [selectedDoc],
  );

  const handleNewNotification = useCallback(
    (notif: Notification) => {
      setCachedSummaries((prev) => ({
        ...prev,
        [notif.filename]: {
          summaryResult: notif.result,
          chatHistory: [],
          timestamp: new Date().getTime(),
        },
      }));
      setNotifications((prev) => [
        { ...notif, read: false, timestamp: new Date().getTime() },
        ...prev,
      ]);
      setUnreadCount((prev) => prev + 1);
      if (onShowSnackbar) onShowSnackbar(`Summary ready for ${notif.filename}`);
    },
    [onShowSnackbar],
  );

  const handleNotificationClick = useCallback(
    (notif: Notification): boolean => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.filename === notif.filename ? { ...n, read: true } : n,
        ),
      );
      if (!notif.read) setUnreadCount((prev) => Math.max(0, prev - 1));

      setSelectedDoc(notif.filename);

      if (
        (!notif.result || notif.result === "No text") &&
        cachedSummaries[notif.filename]
      ) {
        const entry = cachedSummaries[notif.filename];
        setSummaryResult(entry.summaryResult || null);
        setChatHistory(entry.chatHistory || []);
      } else {
        setSummaryResult(notif.result || null);
        setChatHistory([]);
      }
      return true;
    },
    [cachedSummaries],
  );

  const fetchBackendSummaries = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/agent/summaries`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const history = res.data.summaries.map((s: any) => ({
        filename: s.filename,
        result: s.summary_text || "No text",
        status: "completed",
        read: true,
        timestamp: s.created_at,
      }));
      setNotifications((prev) => {
        const existingFiles = new Set(prev.map((p) => p.filename));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newItems = history.filter(
          (h: any) => !existingFiles.has(h.filename),
        );
        return [...prev, ...newItems];
      });
    } catch (error) {
      console.error("Failed to load summary history", error);
    }
  }, []);

  return {
    selectedDoc,
    setSelectedDoc,
    summaryResult,
    setSummaryResult,
    chatHistory,
    chatLoading,
    isSummarizing,
    activeSummaries,
    setActiveSummaries,
    notifications,
    unreadCount,
    cachedSummaries,
    handleSummarizeRequest,
    handleSendChat,
    handleSelectCachedSummary,
    handleDeleteCachedSummary,
    handleNewNotification,
    handleNotificationClick,
    fetchBackendSummaries,
  };
}
