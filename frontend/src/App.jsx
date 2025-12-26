import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppBar, Toolbar, Typography, Container, Box, TextField, Button, Paper, List, ListItem, ListItemText, Divider, Alert, CircularProgress, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
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

  // Fetch Documents
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/agent/documents`);
      setDocuments(response.data.documents);
      setView('list');
    } catch (error) {
      console.error("Error fetching documents:", error);
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
            {documents.length === 0 ? (
              <Alert severity="info">No documents found. Drop files into 'monitored_data' folder.</Alert>
            ) : (
              <List>
                {documents.map((doc, index) => (
                  <React.Fragment key={doc.id || index}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={doc.filename}
                        secondary={
                          <Typography
                            sx={{ display: 'inline' }}
                            component="span"
                            variant="body2"
                            color="text.secondary"
                          >
                            {doc.content_snippet}...
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < documents.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        )}

        {!loading && view === 'search' && (
          <Box>
            {searchData.answer && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: '#004d40' }}>
                <Typography variant="h5" gutterBottom sx={{ color: '#e0f2f1' }}>Generative Answer</Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem' }}>
                  {searchData.answer}
                </Typography>
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
      </Container>
    </ThemeProvider>
  );
}

export default App;
