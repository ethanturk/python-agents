import React, {
  createContext,
  useEffect,
  useState,
  useCallback,
  useContext,
} from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { useAuth } from "./AuthContext";

interface DocumentSetContextValue {
  documentSets: string[];
  selectedSet: string;
  setSelectedSet: (set: string) => void;
  fetchDocumentSets: () => Promise<void>;
  loading: boolean;
}

export const DocumentSetContext = createContext<
  DocumentSetContextValue | undefined
>(undefined);

interface DocumentSetProviderProps {
  children: React.ReactNode;
}

export function DocumentSetProvider({ children }: DocumentSetProviderProps) {
  const [documentSets, setDocumentSets] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState<string>(
    sessionStorage.getItem("selectedDocumentSet") || "default",
  );
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  const fetchDocumentSets = useCallback(async () => {
    try {
      const config: any = {};
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
  }, [currentUser]);

  useEffect(() => {
    sessionStorage.setItem("selectedDocumentSet", selectedSet);
  }, [selectedSet]);

  const value: DocumentSetContextValue = {
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

export function useDocumentSet() {
  const context = useContext(DocumentSetContext);
  if (context === undefined) {
    throw new Error("useDocumentSet must be used within a DocumentSetProvider");
  }
  return context;
}
