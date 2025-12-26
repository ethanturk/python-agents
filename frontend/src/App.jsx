import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppBar, Toolbar, Typography, Container, Box, TextField, Button, Paper, List, ListItem, ListItemText, Divider, Alert, CircularProgress, Accordion, AccordionSummary, AccordionDetails, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';

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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://192.168.5.200:9999';

function App() {
  const [documents, setDocuments] = useState([]);
  const [searchData, setSearchData] = useState({ answer: null, results: [] });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list'); // 'list', 'search', 'summarize'

  // Grouped Documents State
  const [groupedDocs, setGroupedDocs] = useState({});

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);

  // Summarize State
  const [selectedDocForSummary, setSelectedDocForSummary] = useState('');
  const [summaryResult, setSummaryResult] = useState(null);

  // Helper to get web link from absolute path
  const getWebLink = (filepath) => {
    if (!filepath) return "#";
    // Assuming backend mounts /data/monitored at /agent/files
    // And filepath is like /data/monitored/subdir/file.pdf
    // We need to strip /data/monitored/
    const prefix = "/data/monitored/";
    if (filepath.startsWith(prefix)) {
      const relative = filepath.substring(prefix.length);
      return `${API_BASE}/agent/files/${relative}`;
    }
    // Fallback if path structure is different (e.g. flat) or unknown
    const parts = filepath.split('/');
    return `${API_BASE}/agent/files/${parts[parts.length - 1]}`;
  };

  const getFilenameOnly = (filepath) => {
    if (!filepath) return "Unknown";
    const parts = filepath.split('/');
    return parts[parts.length - 1];
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

      setGroupedDocs(groups);
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

  const handleSwitchToSummarize = async () => {
    await ensureDocsLoaded();
    setView('summarize');
  };

  const handleSwitchToDocs = async () => {
    await ensureDocsLoaded();
    setView('list');
  };

  // Handle Delete Click
  const promptDelete = (filename, e) => {
    e.stopPropagation(); // Prevent accordion expansion
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

  // Handle Summarize
  const handleSummarize = async () => {
    if (!selectedDocForSummary) return;
    setLoading(true);
    setSummaryResult(null);
    try {
      const response = await axios.post(`${API_BASE}/agent/summarize`, { filename: selectedDocForSummary });
      setSummaryResult(response.data.summary);
    } catch (error) {
      console.error("Error summarizing:", error);
      alert("Failed to summarize document");
    } finally {
      setLoading(false);
    }
  };

  // Search Documents
  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/agent/search`, { prompt: query });
      const data = response.data;
      if (data.answer) {
        setSearchData({ answer: data.answer, results: data.results || [] });
      } else {
        setSearchData({ answer: null, results: data.results || [] });
      }
      setView('search');
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Agent Document Manager
          </Typography>
          <Button color="inherit" onClick={handleSwitchToDocs}>Documents</Button>
          <Button color="inherit" onClick={handleSwitchToSummarize}>Summarize</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        {/* Search Bar */}
        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 4 }}>
          <TextField
            fullWidth
            label="Search Agent Knowledge"
            variant="outlined"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button
            variant="contained"
            sx={{ ml: 2, height: '56px' }}
            onClick={handleSearch}
            startIcon={<SearchIcon />}
          >
            Search
          </Button>
        </Paper>

        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>}

        {/* View: Document List */}
        {!loading && view === 'list' && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>Ingested Documents</Typography>
            {Object.keys(groupedDocs).length === 0 ? (
              <Alert severity="info">No documents found. Drop files into 'monitored_data' folder.</Alert>
            ) : (
              <Box>
                {Object.entries(groupedDocs).map(([filename, chunks]) => (
                  <Accordion key={filename}>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center', justifyContent: 'space-between' } }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ mr: 2 }}>{getFilenameOnly(filename)}</Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          href={getWebLink(filename)}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          startIcon={<DescriptionIcon />}
                        >
                          View
                        </Button>
                      </Box>
                      <IconButton onClick={(e) => promptDelete(filename, e)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Full Path: {filename}</Typography>
                      <Typography variant="body2">{chunks.length} chunks indexed.</Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Paper>
        )}

        {/* View: Summarize */}
        {!loading && view === 'summarize' && (
          <Paper sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom>Summarize Document</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Select Document</InputLabel>
                <Select
                  value={selectedDocForSummary}
                  label="Select Document"
                  onChange={(e) => setSelectedDocForSummary(e.target.value)}
                >
                  {Object.keys(groupedDocs).map((filename) => (
                    <MenuItem key={filename} value={filename}>
                      {getFilenameOnly(filename)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                size="large"
                onClick={handleSummarize}
                disabled={!selectedDocForSummary}
                startIcon={<SummarizeIcon />}
              >
                Summarize
              </Button>
            </Box>

            {summaryResult && (
              <Box>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Summary Result</Typography>
                  <Button variant="outlined" href={getWebLink(selectedDocForSummary)} target="_blank">
                    View Original Document
                  </Button>
                </Box>
                <Paper elevation={3} sx={{ p: 3, bgcolor: 'background.default' }}>
                  <Box sx={{
                    '& p': { fontSize: '1.05rem', lineHeight: 1.6, mb: 2 },
                    '& ul, & ol': { ml: 2, mb: 2 },
                    '& li': { mb: 1 },
                    '& strong': { color: '#90caf9' }
                  }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryResult}</ReactMarkdown>
                  </Box>
                </Paper>
              </Box>
            )}
          </Paper>
        )}

        {/* View: Search Results */}
        {!loading && view === 'search' && (
          <Box>
            {searchData.answer && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: '#004d40' }}>
                <Typography variant="h5" gutterBottom sx={{ color: '#e0f2f1' }}>Generative Answer</Typography>
                <Box sx={{
                  color: '#e0f2f1',
                  '& p': { fontSize: '1.1rem', lineHeight: 1.6, mb: 2 },
                  '& ul, & ol': { ml: 2, mb: 2 },
                  '& li': { mb: 1, fontSize: '1.1rem' },
                  '& strong': { color: '#80cbc4' },
                  '& table': { width: '100%', borderCollapse: 'collapse', mb: 2 },
                  '& th, & td': { border: '1px solid #4db6ac', padding: '8px', textAlign: 'left' },
                  '& th': { backgroundColor: '#00695c', color: '#ffffff' }
                }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{searchData.answer}</ReactMarkdown>
                </Box>
              </Paper>
            )}

            <Accordion defaultExpanded={!searchData.answer}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Related Documents</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {searchData.results.length === 0 ? (
                  <Alert severity="warning">No matches found.</Alert>
                ) : (
                  <List>
                    {[...new Set(searchData.results.map(r => r.metadata.filename))].map((filename, index) => (
                      <React.Fragment key={index}>
                        <ListItem alignItems="center">
                          <ListItemText
                            primary={getFilenameOnly(filename)}
                            secondary={filename}
                          />
                          <Button
                            variant="outlined"
                            href={getWebLink(filename)}
                            target="_blank"
                            startIcon={<DescriptionIcon />}
                          >
                            View Document
                          </Button>
                        </ListItem>
                        {index < [...new Set(searchData.results.map(r => r.metadata.filename))].length - 1 && <Divider component="li" />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete <strong>{getFilenameOnly(docToDelete)}</strong>? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmDelete} color="error" autoFocus>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
}

export default App;
