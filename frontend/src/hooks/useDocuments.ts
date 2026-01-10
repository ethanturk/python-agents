import { useState, useCallback } from "react";
import axios from "axios";
import { API_BASE } from "@/config";

interface DocumentData {
  id?: string;
  filename: string;
  document_set?: string;
  chunk_count?: number;
}

interface GroupedDocs {
  [filename: string]: DocumentData[];
}

interface UseDocumentsReturn {
  groupedDocs: GroupedDocs;
  loading: boolean;
  deleteDialogOpen: boolean;
  docToDelete: string | null;
  fetchDocuments: () => Promise<void>;
  ensureDocsLoaded: () => Promise<void>;
  handlePromptDelete: (filename: string, documentSet?: string) => void;
  confirmDelete: () => Promise<void>;
  setDeleteDialogOpen: (open: boolean) => void;
}

export default function useDocuments(): UseDocumentsReturn {
  const [groupedDocs, setGroupedDocs] = useState<GroupedDocs>({});
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [docSetToDelete, setDocSetToDelete] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/agent/documents`);
      const docs = response.data.documents;

      const groups: GroupedDocs = docs.reduce((acc, doc) => {
        const file = doc.filename || "Unknown";
        acc[file] = [
          {
            id: doc.id,
            filename: doc.filename,
            document_set: doc.document_set,
            chunk_count: doc.chunk_count,
          },
        ];
        return acc;
      }, {} as GroupedDocs);

      const sortedGroups = Object.fromEntries(Object.entries(groups).sort());
      setGroupedDocs(sortedGroups);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureDocsLoaded = useCallback(async () => {
    if (Object.keys(groupedDocs).length === 0) {
      await fetchDocuments();
    }
  }, [groupedDocs, fetchDocuments]);

  const handlePromptDelete = useCallback(
    (filename: string, documentSet?: string) => {
      setDocToDelete(filename);
      setDocSetToDelete(documentSet || null);
      setDeleteDialogOpen(true);
    },
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (!docToDelete) return;
    try {
      await axios.delete(`${API_BASE}/agent/documents/${docToDelete}`, {
        params: { document_set: docSetToDelete },
      });
      await fetchDocuments();
      setDeleteDialogOpen(false);
      setDocToDelete(null);
      setDocSetToDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document");
    }
  }, [docToDelete, docSetToDelete, fetchDocuments]);

  return {
    groupedDocs,
    loading,
    deleteDialogOpen,
    docToDelete,
    fetchDocuments,
    ensureDocsLoaded,
    handlePromptDelete,
    confirmDelete,
    setDeleteDialogOpen,
  };
}
