import React from 'react';
import { Paper, Typography, Box, Alert, Accordion, AccordionSummary, AccordionDetails, Button, IconButton, List, ListItem, ListItemText, Divider } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import { getWebLink, getFilenameOnly } from '../utils';

export default function DocumentListView({ groupedDocs, onDelete }) {
    return (
        <Paper className="p-2">
            <Typography variant="h5" gutterBottom>Ingested Documents</Typography>
            {Object.keys(groupedDocs).length === 0 ? (
                <Alert severity="info">No documents found. Drop files into 'monitored_data' folder.</Alert>
            ) : (
                <Box>
                    {Object.entries(groupedDocs).map(([filename, chunks]) => (
                        <Accordion key={filename}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                className="custom-accordion-summary"
                            >
                                <Box className="flex-center">
                                    <Typography variant="h6" className="mr-2">{getFilenameOnly(filename)}</Typography>
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
                                <IconButton onClick={(e) => onDelete(filename, e)} color="error" size="small">
                                    <DeleteIcon />
                                </IconButton>
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
