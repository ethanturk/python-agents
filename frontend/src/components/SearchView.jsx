import React from 'react';
import { Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails, Alert, List, ListItem, ListItemText, Button, Divider, TextField } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getWebLink, getFilenameOnly } from '../utils';

export default function SearchView({ query, setQuery, onSearch, searchData }) {
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

            <Accordion defaultExpanded={!searchData.answer}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6">Related Documents ({searchData.results.length})</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {searchData.results.length === 0 ? (
                        <Alert severity="info" className="w-100">
                            {searchData.answer ? "No citation sources found." : "Enter a query to search documents."}
                        </Alert>
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
    );
}
