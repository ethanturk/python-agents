import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppBar, Toolbar, Typography, Container, Box, TextField, Button, Paper, List, ListItem, ListItemText, Divider, Alert, CircularProgress, Accordion, AccordionSummary, AccordionDetails, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
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
  const [view, setView] = useState('list'); // 'list' or 'search'

  // Grouped Documents State
  const [groupedDocs, setGroupedDocs] = useState({});

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);

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
      setView('list');
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
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
      fetchDocuments();
      setDeleteDialogOpen(false);
      setDocToDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document");
    }
  };

  // Search Documents
  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/agent/search`, { prompt: query });
      // Logic to handle old vs new response format or just expect new
      const data = response.data;
      if (data.answer) {
        setSearchData({ answer: data.answer, results: data.results || [] });
      } else {
        // Fallback if API hasn't updated or returns old format
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
          <Button color="inherit" onClick={fetchDocuments}>Documents</Button>
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

        {/* Views */}
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
                      <Typography variant="h6">{filename} ({chunks.length} chunks)</Typography>
                      <IconButton onClick={(e) => promptDelete(filename, e)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List>
                        {chunks.map((doc, index) => (
                          <React.Fragment key={index}>
                            <ListItem alignItems="flex-start">
                              <ListItemText
                                secondary={doc.content_snippet + "..."}
                              />
                            </ListItem>
                            {index < chunks.length - 1 && <Divider component="li" />}
                          </React.Fragment>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Paper>
        )}

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
                <Typography variant="h6">Raw Retrieval Results ({searchData.results.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {searchData.results.length === 0 ? (
                  <Alert severity="warning">No matches found.</Alert>
                ) : (
                  <List>
                    {searchData.results.map((result, index) => (
                      <React.Fragment key={index}>
                        <ListItem alignItems="flex-start">
                          <ListItemText
                            primary={
                              <Typography variant="subtitle1" color="primary">
                                Source: {result.metadata.filename || "Unknown"}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {result.content}
                              </Typography>
                            }
                          />
                        </ListItem>
                        {index < searchData.results.length - 1 && <Divider component="li" />}
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
              Are you sure you want to delete <strong>{docToDelete}</strong>? This action cannot be undone.
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
