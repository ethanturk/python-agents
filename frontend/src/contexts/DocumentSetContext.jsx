/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { useAuth } from "../hooks/useAuth";

export const DocumentSetContext = createContext();

export function DocumentSetProvider({ children }) {
  const [documentSets, setDocumentSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(
    sessionStorage.getItem("selectedDocumentSet") || "default",
  );
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Fetch sets
  const fetchDocumentSets = async () => {
    try {
      const config = {};
      if (currentUser) {
        const token = await currentUser.getIdToken();
        config.headers = { Authorization: `Bearer ${token}` };
      }

      const response = await axios.get(
        `${API_BASE}/agent/documentsets`,
        config,
      );
      setDocumentSets(response.data.document_sets || []);
    } catch (error) {
      console.error("Failed to fetch document sets", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    sessionStorage.setItem("selectedDocumentSet", selectedSet);
  }, [selectedSet]);

  // Validate selectedSet against fetched documentSets
  useEffect(() => {
    if (!loading && documentSets.length > 0) {
      if (selectedSet !== "all" && !documentSets.includes(selectedSet)) {
        setSelectedSet("all");
      }
    }
  }, [documentSets, loading, selectedSet]);

  const value = {
    documentSets,
    selectedSet,
    setSelectedSet,
    fetchDocumentSets,
    loading,
  };

  return (
    <DocumentSetContext.Provider value={value}>
      {children}
    </DocumentSetContext.Provider>
  );
}
