import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { auth } from "./firebase";

import NavBar from "./components/NavBar";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog";
import NotificationSidebar from "./components/NotificationSidebar";
import { useAuth } from "./contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const SearchView = lazy(() => import("./components/SearchView"));
const DocumentListView = lazy(() => import("./components/DocumentListView"));
const SummarizeView = lazy(() => import("./components/SummarizeView"));

import usePolling from "./hooks/usePolling";
import useDocuments from "./hooks/useDocuments";
import useSearch from "./hooks/useSearch";
import useSummarization from "./hooks/useSummarization";
import useOnlineStatus from "./hooks/useOnlineStatus";

function App() {
  const { currentUser, loginWithGoogle } = useAuth();

  const [view, setView] = useState("search");
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
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
  } = useSummarization({ onShowSnackbar: setSnackbarMessage });

  const {
    groupedDocs,
    loading: docsLoading,
    fetchDocuments,
    ensureDocsLoaded,
    deleteDialogOpen,
    docToDelete,
    handlePromptDelete,
    confirmDelete,
    setDeleteDialogOpen,
  } = useDocuments();

  const {
    query,
    setQuery,
    searchData,
    searchLimit,
    setSearchLimit,
    loading: searchLoading,
    searchChatHistory,
    searchChatLoading,
    validationError: searchValidationError,
    handleSearch,
    handleSendSearchChat,
  } = useSearch();

  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "summary_complete") {
          handleNewNotification(data);
          setActiveSummaries((prev) => prev.filter((f) => f !== data.filename));
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000);
        } else if (data.type === "summary_failed") {
          setActiveSummaries((prev) => prev.filter((f) => f !== data.filename));
          setSnackbarMessage(`Summary failed for ${data.filename}`);
        }
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    },
    [handleNewNotification, setActiveSummaries],
  );

  const { isConnected, isConnecting } = usePolling({
    onMessage: (data) =>
      handleWsMessage({ data: JSON.stringify(data) } as MessageEvent),
  });
  const isOnline = useOnlineStatus();
  const [showWsWarning, setShowWsWarning] = useState(false);

  useEffect(() => {
    if (!isConnected && !isConnecting && isOnline) {
      const timer = setTimeout(() => setShowWsWarning(true), 5000);
      return () => clearTimeout(timer);
    } else {
      setTimeout(() => setShowWsWarning(false), 0);
    }
    return () => {};
  }, [isConnected, isConnecting, isOnline]);

  useEffect(() => {
    if (currentUser) {
      fetchBackendSummaries();
    }
  }, [currentUser, fetchBackendSummaries]);

  useEffect(() => {
    if (snackbarMessage) {
      setSnackbarMessage(null);
    }
  }, [snackbarMessage]);

  const handleSwitchToSearch = () => {
    setView("search");
  };

  const handleSwitchToSummarize = async () => {
    await ensureDocsLoaded();
    setView("summarize");
  };

  const handleSwitchToDocs = async () => {
    await ensureDocsLoaded();
    setView("list");
  };

  const handleManualDocumentSelection = (filename: string) => {
    setSelectedDoc(filename);
    setSummaryResult("");
  };

  const handleSelectCachedSummaryWrapper = (filename: string) => {
    const switched = handleSelectCachedSummary(filename);
    if (switched) handleSwitchToSummarize();
  };

  const handleNotificationClickWrapper = (notif: any) => {
    const switched = handleNotificationClick(notif);
    if (switched) handleSwitchToSummarize();
    setSidebarOpen(false);
  };

  const handleSummarizeFromList = async (filename: string) => {
    setSelectedDoc(filename);
    setSummaryResult("");
    setView("summarize");
    await handleSummarizeRequest(filename);
  };

  if (!currentUser) {
    return (
      <div className="container mx-auto mt-8 max-w-sm">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Please Sign In</h2>
          <p className="mb-6">You need to be signed in to access the agent.</p>
          <Button onClick={loginWithGoogle} size="lg">
            Sign In with Google
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground"
      >
        Skip to main content
      </a>

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

      <div className="container mx-auto mt-4 mb-8" id="main-content">
        {docsLoading && view === "list" && (
          <div className="flex justify-center my-4">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {!isOnline && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              No internet connection. Please check your network.
            </AlertDescription>
          </Alert>
        )}

        {showWsWarning && (
          <Alert className="mb-4">
            <AlertDescription>
              Real-time updates temporarily unavailable. Reconnecting...
            </AlertDescription>
          </Alert>
        )}

        {view === "search" && (
          <Suspense
            fallback={
              <div className="flex justify-center my-4">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }
          >
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
              validationError={searchValidationError}
            />
          </Suspense>
        )}

        {!docsLoading && view === "list" && (
          <Suspense
            fallback={
              <div className="flex justify-center my-4">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }
          >
            <DocumentListView
              groupedDocs={groupedDocs}
              onDelete={handlePromptDelete}
              onSummarize={handleSummarizeFromList}
              onRefresh={fetchDocuments}
            />
          </Suspense>
        )}

        {view === "summarize" && (
          <Suspense
            fallback={
              <div className="flex justify-center my-4">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }
          >
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
              onSelectCachedSummary={handleSelectCachedSummaryWrapper}
              onDeleteCachedSummary={handleDeleteCachedSummary}
              activeSummaries={activeSummaries}
            />
          </Suspense>
        )}

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          filename={docToDelete}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
        />
      </div>

      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export default App;
