"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import NavBar from "@/components/NavBar";
import DocumentListView from "@/components/DocumentListView";

import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import NotificationSidebar from "@/components/NotificationSidebar";
import usePolling from "@/hooks/usePolling";
import useDocuments from "@/hooks/useDocuments";
import useSummarization from "@/hooks/useSummarization";
import useOnlineStatus from "@/hooks/useOnlineStatus";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function Home() {
  const { currentUser: user, loginWithGoogle: signInWithGoogle } = useAuth();
  const router = useRouter();

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      // router.push("/"); // Already on /, maybe show login
    }
  }, [user, router]);

  const [showSuccess, setShowSuccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Summarization Hook
  const {
    activeSummaries,
    setActiveSummaries,
    notifications,
    unreadCount,
    handleDeleteCachedSummary,
    handleNewNotification,
    handleNotificationClick,
    fetchBackendSummaries,
    handleSummarizeRequest,
  } = useSummarization({ onShowSnackbar: (msg) => toast(msg) });

  // Documents Hook
  const {
    groupedDocs,
    fetchDocuments,
    deleteDialogOpen,
    docToDelete,
    handlePromptDelete,
    confirmDelete,
    setDeleteDialogOpen,
  } = useDocuments();

  // WebSocket / Polling
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
          toast(`Summary failed for ${data.filename}`);
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
  }, [isConnected, isConnecting, isOnline]);

  useEffect(() => {
    if (user) {
      fetchBackendSummaries();
    }
  }, [user, fetchBackendSummaries]);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Welcome to Document Assistant
          </h1>
          <button
            onClick={signInWithGoogle}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Main View
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        onShowNotifications={() => setSidebarOpen(true)}
        unreadCount={unreadCount}
        loading={activeSummaries.length > 0}
        showSuccess={showSuccess}
      />

      <NotificationSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notifications={notifications}
        onNotificationClick={(notif) => {
          handleNotificationClick(notif);
          setSidebarOpen(false);
        }}
        activeSummaries={activeSummaries}
        onDeleteCachedSummary={handleDeleteCachedSummary}
      />

      <main className="container mx-auto px-4 py-8">
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

        <DocumentListView
          groupedDocs={groupedDocs}
          onDelete={handlePromptDelete}
          onSummarize={handleSummarizeRequest}
          onRefresh={fetchDocuments}
        />

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          filename={docToDelete || ""}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
        />
      </main>
    </div>
  );
}
