import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
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
import { useAuth } from './contexts/AuthContext';
import darkTheme from './theme';

// Hooks
import useWebSocket from './hooks/useWebSocket';
import useDocuments from './hooks/useDocuments';
import useSearch from './hooks/useSearch';
import useSummarization from './hooks/useSummarization';

function App() {
  const { currentUser, loginWithGoogle } = useAuth();
  
  // UI State
  const [view, setView] = useState('search'); // 'list', 'search', 'summarize'
  const [snackbarMessage, setSnackbarMessage] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Hooks Initialization ---
  
  const {
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
  } = useSummarization({ onShowSnackbar: setSnackbarMessage });

  const {
      groupedDocs, loading: docsLoading, fetchDocuments, ensureDocsLoaded,
      deleteDialogOpen, docToDelete, handlePromptDelete, confirmDelete, setDeleteDialogOpen
  } = useDocuments();

  const {
      query, setQuery, searchData, searchLimit, setSearchLimit,
      loading: searchLoading,
      searchChatHistory, searchChatLoading,
      handleSearch, handleSendSearchChat
  } = useSearch();

  // WebSocket Message Handler
  const handleWsMessage = useCallback((event) => {
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
  }, [handleNewNotification, setActiveSummaries]);

  const { isConnected } = useWebSocket({ onMessage: handleWsMessage });

  // --- Effects ---

  // Axios Interceptor for Auth Token
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(async (config) => {
      if (currentUser) {
        const token = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    }, (error) => {
      return Promise.reject(error);
    });

    return () => {
       axios.interceptors.request.eject(interceptor);
    }
  }, [currentUser]);

  // Initial Data Fetch
  useEffect(() => {
    if (currentUser) {
        fetchBackendSummaries();
    }
  }, [currentUser, fetchBackendSummaries]);


  // --- View Handlers ---

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

  const handleManualDocumentSelection = (filename) => {
      setSelectedDoc(filename);
      setSummaryResult(null); 
      // Reuse logic from manually clearing? useSummarization logic sets it.
  };

  const handleSelectCachedSummaryWrapper = (filename) => {
      const switched = handleSelectCachedSummary(filename);
      if (switched) handleSwitchToSummarize();
  };

  const handleNotificationClickWrapper = (notif) => {
      const switched = handleNotificationClick(notif);
      if (switched) handleSwitchToSummarize();
      setSidebarOpen(false);
  };

  const handleSummarizeFromList = async (filename) => {
      setSelectedDoc(filename);
      setSummaryResult(null);
      // setChatHistory([]) // handled in hook?
      setView('summarize');
      await handleSummarizeRequest(filename);
  }

  // --- Render ---

  if (!currentUser) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
           <Box sx={{ p: 4, bgcolor: 'background.paper', borderRadius: 2, textAlign: 'center' }}>
             <h2>Please Sign In</h2>
             <p>You need to be signed in to access the agent.</p>
             <button onClick={loginWithGoogle} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
               Sign In with Google
             </button>
           </Box>
        </Container>
      </ThemeProvider>
    );
  }

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
        onNotificationClick={handleNotificationClickWrapper}
        activeSummaries={activeSummaries}
        onDeleteCachedSummary={handleDeleteCachedSummary}
      />

      <Container maxWidth="xl" className={['mt-4', 'mb-2'].join(' ')}>
        {/* Global Loading (except search view) */}
        {docsLoading && view === 'list' && <Box className="flex-justify-center my-4"><CircularProgress /></Box>}

        {/* Connection Status Indicator */}
        {!isConnected && (
          <Alert severity="warning" className="mb-2">
            WebSocket disconnected. Attempting to reconnect...
          </Alert>
        )}

        {/* View: Search View (Default) */}
        {view === 'search' && (
          <SearchView
            query={query}
            setQuery={setQuery}
            onSearch={handleSearch}
            searchData={searchData}
            searchLimit={searchLimit}
            setSearchLimit={setSearchLimit}
            loading={searchLoading}
            searchChatHistory={searchChatHistory}
            onSendSearchChat={handleSendSearchChat}
            searchChatLoading={searchChatLoading}
          />
        )}

        {/* View: Document List */}
        {!docsLoading && view === 'list' && (
          <DocumentListView
            groupedDocs={groupedDocs}
            onDelete={handlePromptDelete}
            onSummarize={handleSummarizeFromList}
            onRefresh={fetchDocuments}
          />
        )}

        {/* View: Summarize */}
        {view === 'summarize' && (
          <SummarizeView
            groupedDocs={groupedDocs}
            onSummarize={handleSummarizeRequest}
            summaryResult={summaryResult}
            loading={isSummarizing}
            selectedDoc={selectedDoc}
            setSelectedDoc={handleManualDocumentSelection} // Wrapper needed? Hook exposes setter.
            chatHistory={chatHistory}
            onSendChat={handleSendChat}
            chatLoading={chatLoading}
            cachedSummaries={cachedSummaries}
            onSelectCachedSummary={handleSelectCachedSummaryWrapper}
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
