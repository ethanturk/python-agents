import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

export default function useDocuments() {
  const [groupedDocs, setGroupedDocs] = useState({});
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);

  const [docSetToDelete, setDocSetToDelete] = useState(null);

  const fetchDocuments = useCallback(async () => {
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
  }, []);

  const ensureDocsLoaded = useCallback(async () => {
    if (Object.keys(groupedDocs).length === 0) {
      await fetchDocuments();
    }
  }, [groupedDocs, fetchDocuments]);

  const handlePromptDelete = useCallback((filename, documentSet) => {
    setDocToDelete(filename);
    setDocSetToDelete(documentSet);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!docToDelete) return;
    try {
      await axios.delete(`${API_BASE}/agent/documents/${docToDelete}`, {
        params: { document_set: docSetToDelete }
      });
      // Refresh list
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
    setDeleteDialogOpen
  };
}
