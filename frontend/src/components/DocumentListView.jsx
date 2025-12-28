import React from 'react';
import { Paper, Typography, Box, Alert, Accordion, AccordionSummary, AccordionDetails, Button, IconButton, List, ListItem, ListItemText, Divider } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { getWebLink, getFilenameOnly } from '../utils';

export default function DocumentListView({ groupedDocs, onDelete, onSummarize }) {
    return (
        <Paper className="p-2">
            <Typography variant="h5" gutterBottom>Ingested Documents ({Object.keys(groupedDocs).length})</Typography>
            {Object.keys(groupedDocs).length === 0 ? (
                <Alert severity="info">No documents found. Drop files into 'monitored_data' folder.</Alert>
            ) : (
                <Box>
                    {Object.entries(groupedDocs).map(([filename, chunks]) => (
                        <Accordion key={filename}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                className="custom-accordion-summary"
                                component="div"
                            >
                                <Box className="document-row">
                                    <Typography
                                        variant="body1"
                                        noWrap
                                        className="document-filename"
                                        title={filename} // Tooltip for full filename on hover
                                    >
                                        {getFilenameOnly(filename)}
                                    </Typography>
                                    <Box className="document-actions">
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            href={getWebLink(filename)}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                            startIcon={<DescriptionIcon />}
                                            className="action-button-view"
                                        >
                                            View
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="secondary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSummarize(filename);
                                            }}
                                            startIcon={<SummarizeIcon />}
                                            className="action-button-summarize"
                                            sx={{ ml: 1 }}
                                        >
                                            Summarize
                                        </Button>
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(filename);
                                            }}
                                            color="error"
                                            size="small"
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="subtitle2" className="mb-1 text-secondary">Full Path: {filename}</Typography>
                                <Typography variant="body2">{chunks.length} chunks indexed.</Typography>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            )}
        </Paper>
    );
}
