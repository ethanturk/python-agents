import React from 'react';
import { Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails, Alert, List, ListItem, ListItemText, Button, Divider, TextField } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getWebLink, getFilenameOnly } from '../utils';

export default function SearchView({ query, setQuery, onSearch, searchData }) {
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
                <Button
                    variant="contained"
                    className="search-button"
                    onClick={onSearch}
                    startIcon={<SearchIcon />}
                >
                    Search
                </Button>
            </Paper>

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
