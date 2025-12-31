import React from 'react';
import { Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails, Alert, List, ListItem, ListItemText, Button, Divider, TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getWebLink, getFilenameOnly } from '../utils';

export default function SearchView({ query, setQuery, onSearch, searchData, searchLimit, setSearchLimit, loading }) {
    // Calculate unique filenames for display
    const uniqueFiles = [...new Set(searchData.results.map(r => r.metadata.filename))];

    return (
        <Box>
            <Paper className="search-bar-paper">
                <TextField
                    fullWidth
                    label="Search Agent Knowledge"
                    variant="outlined"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && onSearch()}
                />
                <FormControl className="ml-2" variant="outlined" style={{ minWidth: 100 }}>
                    <InputLabel id="limit-select-label">Limit</InputLabel>
                    <Select
                        labelId="limit-select-label"
                        id="limit-select"
                        value={searchLimit}
                        onChange={(e) => setSearchLimit(e.target.value)}
                        label="Limit"
                    >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                    </Select>
                </FormControl>
                <Button
                    variant="contained"
                    className="search-button"
                    onClick={onSearch}
                    startIcon={!loading && <SearchIcon />}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Search"}
                </Button>
            </Paper>

            {loading && (
                <Box className="flex-justify-center my-4">
                    <CircularProgress />
                </Box>
            )}

            {searchData.answer && (
                <Paper className="answer-paper">
                    <Typography variant="h5" gutterBottom className="answer-title">Generative Answer</Typography>
                    <Box className="markdown-body markdown-search">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{searchData.answer}</ReactMarkdown>
                    </Box>
                </Paper>
            )}

            {(searchData.answer || uniqueFiles.length > 0) && (
                <Accordion defaultExpanded={!searchData.answer}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6">Related Documents ({uniqueFiles.length})</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {uniqueFiles.length === 0 ? (
                            <Alert severity="info" className="w-100">
                                No citation sources found.
                            </Alert>
                        ) : (
                            <List>
                                {uniqueFiles.map((filename, index) => (
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
                                        {index < uniqueFiles.length - 1 && <Divider component="li" />}
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </AccordionDetails>
                </Accordion>
            )}
        </Box>
    );
}
