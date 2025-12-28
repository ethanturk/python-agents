import { useState, useEffect, useRef } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Box, CircularProgress, Snackbar, Alert } from '@mui/material';
import axios from 'axios';
import './App.css';

import NavBar from './components/NavBar';
import DocumentListView from './components/DocumentListView';
import SearchView from './components/SearchView';
import SummarizeView from './components/SummarizeView';
import DeleteConfirmDialog from './components/DeleteConfirmDialog';
import NotificationSidebar from './components/NotificationSidebar';
import { API_BASE } from './config';

// Determine WS URL
const WS_BASE = API_BASE.replace('http', 'ws') + '/ws';

// Dark Theme Configuration (unchanged)
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '12px 24px',
          fontSize: '1rem',
        },
      },
    },
  },
});

function App() {
  const [searchData, setSearchData] = useState({ answer: null, results: [] });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('search'); // 'list', 'search', 'summarize'
  const [searchLimit, setSearchLimit] = useState(10);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);

  // Summarize Result State
  const [selectedDoc, setSelectedDoc] = useState('');
  const [summaryResult, setSummaryResult] = useState(null);

  // Chat State
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Grouped Documents State
  const [groupedDocs, setGroupedDocs] = useState({});

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [snackbarMessage, setSnackbarMessage] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false); // UI loading state for start btn

  // Tasks Persistence
  const [activeSummaries, setActiveSummaries] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // WebSocket Connection
  const ws = useRef(null);

  // Fetch existing summaries from DB
  const fetchSummaries = async () => {
    try {
      const res = await axios.get(`${API_BASE}/agent/summaries`);
      const history = res.data.summaries.map(s => ({
        filename: s.filename,
        result: s.summary_text || "No text", // handling legacy/schema
        status: 'completed',
        read: true,
        timestamp: s.created_at
      }));
      // Prepend to notifications (or set initial)
      setNotifications(prev => {
        // Avoid duplicates if strict mode mounts twice
        const existingFiles = new Set(prev.map(p => p.filename));
        const newItems = history.filter(h => !existingFiles.has(h.filename));
        return [...prev, ...newItems];
      });
    } catch (error) {
      console.error("Failed to load summary history", error);
    }
  };

  useEffect(() => {
    // Determine WS Base dynamically if needed, or use constant
    ws.current = new WebSocket(WS_BASE);

    ws.current.onopen = () => {
      console.log("WebSocket Connected");
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'summary_complete') {
          handleNewNotification(data);

          // Remove from active list
          setActiveSummaries(prev => prev.filter(f => f !== data.filename));

          // Show success tick
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000);
        } else if (data.type === 'summary_failed') {
          // Handle explicit failure if backend sends it
          setActiveSummaries(prev => prev.filter(f => f !== data.filename));
          setSnackbarMessage(`Summary failed for ${data.filename}`);
        }
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket Disconnected");
    };

    // Load History (DISABLED - Using Local Cache only)
    // fetchSummaries();

    return () => {
      if (ws.current) ws.current.close();
    }
  }, []);

  // --- Persistence Logic ---
  const STORAGE_KEY = 'summarization_cache_v2';
  const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Cache Structure: { [filename]: { summaryResult, chatHistory, timestamp } }
  const [cachedSummaries, setCachedSummaries] = useState({});

  // Load from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const now = new Date().getTime();
        const validCache = {};
        const initialNotifications = [];

        // Load Cache entries
        if (data.cache) {
          Object.entries(data.cache).forEach(([key, value]) => {
            if (now - value.timestamp < EXPIRY_TIME) {
              validCache[key] = value;
              // Add to notifications list
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

        // Sort notifications by timestamp descending (newest first)
        initialNotifications.sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(initialNotifications);

        // Restore active doc if valid
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
  }, []);

  // Update Cache when current summary changes
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

  // Persist Cache to LocalStorage
  useEffect(() => {
    if (!storageLoaded) return;

    // We save the entire cache + the current selectedDoc as "lastActive"
    const stateToSave = {
      lastActiveDoc: selectedDoc,
      cache: cachedSummaries
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [cachedSummaries, selectedDoc, storageLoaded]);

  const handleSelectCachedSummary = (filename) => {
    const entry = cachedSummaries[filename];
    if (entry) {
      setSelectedDoc(filename);
      setSummaryResult(entry.summaryResult);
      setChatHistory(entry.chatHistory || []);
      // Ensure we switch to summarize view
      handleSwitchToSummarize();
    }
  };

  const handleDeleteCachedSummary = (filename) => {
    // If we are currently viewing this doc, clear the view
    if (selectedDoc === filename) {
      setSelectedDoc('');
      setSummaryResult(null);
      setChatHistory([]);
    }

    // Remove from Cache
    setCachedSummaries(prev => {
      const newCache = { ...prev };
      delete newCache[filename];
      return newCache;
    });

    // Remove from Notifications (if present)
    setNotifications(prev => prev.filter(n => n.filename !== filename));
  };

  const handleNewNotification = (notif) => {
    // Add to Cache immediately so it persists if we reload
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
    setSnackbarMessage(`Summary ready for ${notif.filename}`);
  };

  const handleNotificationClick = (notif) => {
    // Mark as read (in UI only for now)
    setNotifications(prev => prev.map(n => n === notif ? { ...n, read: true } : n));
    // Decrement unread only if it was false
    if (!notif.read) setUnreadCount(prev => Math.max(0, prev - 1));

    // Jump to summary
    setSelectedDoc(notif.filename);

    // Prioritize Cache if notif result is missing/placeholder and we have a local copy
    if ((!notif.result || notif.result === "No text") && cachedSummaries[notif.filename]) {
      const entry = cachedSummaries[notif.filename];
      setSummaryResult(entry.summaryResult);
      setChatHistory(entry.chatHistory || []);
    } else {
      setSummaryResult(notif.result);
      setChatHistory([]); // Reset chat for new doc (or maybe we should cache chat too? For now, reset if fresh from backend)
    }

    handleSwitchToSummarize();
    setSidebarOpen(false);
  };

  // Fetch Documents and Group them
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/agent/documents`);
      const docs = response.data.documents;

      // Group by filename
      const groups = docs.reduce((acc, doc) => {
        const file = doc.filename || "Unknown";
        if (!acc[file]) acc[file] = [];
        acc[file].push(doc);
        return acc;
      }, {});

      const sortedGroups = Object.fromEntries(
        Object.entries(groups).sort()
      );

      setGroupedDocs(sortedGroups);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const ensureDocsLoaded = async () => {
    if (Object.keys(groupedDocs).length === 0) {
      await fetchDocuments();
    }
  };

  const handleSwitchToSearch = () => {
    setView('search');
  };

  const handleSwitchToSummarize = async () => {
    await ensureDocsLoaded();
    setView('summarize');
  };

  const handleSwitchToDocs = async () => {
    await ensureDocsLoaded();
    setView('list');
  };

  // Handle Delete Click (triggered from DocumentListView)
  const handlePromptDelete = (filename) => {
    setDocToDelete(filename);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      await axios.delete(`${API_BASE}/agent/documents/${docToDelete}`);
      // Refresh list
      await fetchDocuments();
      setDeleteDialogOpen(false);
      setDocToDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document");
    }
  };

  // Handle Summarize Request (Start Async)
  const handleSummarizeRequest = async (filename) => {
    setIsSummarizing(true);
    setSummaryResult(null); // Clear previous
    setChatHistory([]);
    try {
      await axios.post(`${API_BASE}/agent/summarize`, { filename });
      setSnackbarMessage("Summarization started. You will be notified when ready.");
      setActiveSummaries(prev => [...prev, filename]);

      // Timeout after 5 minutes
      setTimeout(() => {
        setActiveSummaries(prev => {
          if (prev.includes(filename)) {
            // If still active, remove it and notify
            setSnackbarMessage(`Summary request for ${filename} timed out.`);
            return prev.filter(f => f !== filename);
          }
          return prev;
        });
      }, 5 * 60 * 1000); // 5 minutes

    } catch (error) {
      console.error("Error summarizing:", error);
      alert("Failed to start summarization");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Handle Chat Request
  const handleSendChat = async (question) => {
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
      const errorMsg = { role: 'ai', text: "Sorry, I encountered an error." };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // Search Documents
  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/agent/search`, { prompt: query, limit: searchLimit });
      const data = response.data;
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
  };

  // Handle manual selection from dropdown
  const handleManualDocumentSelection = (filename) => {
    setSelectedDoc(filename);
    setSummaryResult(null); // Clear result so we don't cache stale data
    setChatHistory([]);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <NavBar
        onShowSearch={handleSwitchToSearch}
        onShowDocuments={handleSwitchToDocs}
        onShowSummarize={handleSwitchToSummarize}
        onShowNotifications={() => setSidebarOpen(true)}
        unreadCount={unreadCount}
        loading={activeSummaries.length > 0}
        showSuccess={showSuccess}
      />

      <NotificationSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        activeSummaries={activeSummaries}
        onDeleteCachedSummary={handleDeleteCachedSummary}
      />

      <Container maxWidth="xl" className={['mt-4', 'mb-2'].join(' ')}>
        {/* Global Loading for initial data or search */}
        {loading && <Box className="flex-justify-center my-4"><CircularProgress /></Box>}

        {/* View: Search View (Default) */}
        {!loading && view === 'search' && (
          <SearchView
            query={query}
            setQuery={setQuery}
            onSearch={handleSearch}
            searchData={searchData}
            searchLimit={searchLimit}
            setSearchLimit={setSearchLimit}
          />
        )}

        {/* View: Document List */}
        {!loading && view === 'list' && (
          <DocumentListView
            groupedDocs={groupedDocs}
            onDelete={handlePromptDelete}
          />
        )}

        {/* View: Summarize */}
        {!loading && view === 'summarize' && (
          <SummarizeView
            groupedDocs={groupedDocs}
            onSummarize={handleSummarizeRequest}
            summaryResult={summaryResult}
            loading={isSummarizing}
            selectedDoc={selectedDoc}
            setSelectedDoc={handleManualDocumentSelection}
            chatHistory={chatHistory}
            onSendChat={handleSendChat}
            chatLoading={chatLoading}
            cachedSummaries={cachedSummaries}
            onSelectCachedSummary={handleSelectCachedSummary}
            onDeleteCachedSummary={handleDeleteCachedSummary}
            activeSummaries={activeSummaries}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          filename={docToDelete}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
        />

        {/* Snackbar for Notifications */}
        <Snackbar
          open={!!snackbarMessage}
          autoHideDuration={6000}
          onClose={() => setSnackbarMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setSnackbarMessage(null)} severity="success" sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>

      </Container>
    </ThemeProvider>
  );
}

export default App;
