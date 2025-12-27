import { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Box, CircularProgress } from '@mui/material';
import axios from 'axios';
import './App.css';

import NavBar from './components/NavBar';
import DocumentListView from './components/DocumentListView';
import SearchView from './components/SearchView';
import SummarizeView from './components/SummarizeView';
import DeleteConfirmDialog from './components/DeleteConfirmDialog';
import { API_BASE } from './config';

// Dark Theme Configuration
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

  // Summarize Result State (selected doc state is now in SummarizeView -> Lifted to App)
  const [selectedDoc, setSelectedDoc] = useState('');
  const [summaryResult, setSummaryResult] = useState(null);

  // Grouped Documents State
  const [groupedDocs, setGroupedDocs] = useState({});

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

  // Handle Summarize Request (triggered from SummarizeView)
  const handleSummarizeRequest = async (filename) => {
    setLoading(true);
    setSummaryResult(null);
    try {
      const response = await axios.post(`${API_BASE}/agent/summarize`, { filename });
      setSummaryResult(response.data.summary);
    } catch (error) {
      console.error("Error summarizing:", error);
      alert("Failed to summarize document");
    } finally {
      // Don't reset selectedDoc here, so we keep it for the link
      setLoading(false);
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

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <NavBar
        onShowSearch={handleSwitchToSearch}
        onShowDocuments={handleSwitchToDocs}
        onShowSummarize={handleSwitchToSummarize}
      />

      <Container maxWidth="xl" className={['mt-4', 'mb-2'].join(' ')}>
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
            loading={loading}
            selectedDoc={selectedDoc}
            setSelectedDoc={setSelectedDoc}
          />
        )}

        {/* Delete Confirmation Dialog */}

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          filename={docToDelete}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
        />
      </Container>
    </ThemeProvider>
  );
}

export default App;
