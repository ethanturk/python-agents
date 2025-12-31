import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const DocumentSetContext = createContext();

export function useDocumentSet() {
  return useContext(DocumentSetContext);
}

export function DocumentSetProvider({ children }) {
  const [documentSets, setDocumentSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(
    sessionStorage.getItem('selectedDocumentSet') || 'default'
  );
  const [loading, setLoading] = useState(true);

  // Fetch sets
  const fetchDocumentSets = async () => {
    try {
      // Need auth? Usually yes. But we might not have headers set up here if it's too early.
      // However, App.jsx sets up interceptors.
      // If this provider is outside App, it might not benefit from App's interceptor setup 
      // UNLESS the interceptor is global or we move this provider inside App or replicate interceptor.
      // Actually, App.jsx sets up the interceptor.
      // If we wrap App with DocumentSetProvider, the children (App) renders, 
      // but the interceptor is set in App's useEffect, which runs AFTER render.
      // So initial fetch might fail if it needs auth.
      // We should probably expose a fetch method that App can call, or handle auth here.
      // But we can check if we have a user token.

      // For now, let's assume we might need to rely on the user refreshing or App calling it?
      // Or we just try.
      
      const response = await axios.get(`${API_BASE}/agent/documentsets`);
      setDocumentSets(response.data.document_sets || []);
    } catch (error) {
      console.error("Failed to fetch document sets", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    sessionStorage.setItem('selectedDocumentSet', selectedSet);
  }, [selectedSet]);

  const value = {
    documentSets,
    selectedSet,
    setSelectedSet,
    fetchDocumentSets,
    loading
  };

  return (
    <DocumentSetContext.Provider value={value}>
      {children}
    </DocumentSetContext.Provider>
  );
}
