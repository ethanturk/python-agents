import React, { useState } from 'react';
import { Paper, Typography, Box, Alert, Accordion, AccordionSummary, AccordionDetails, Button, IconButton, List, ListItem, ListItemText, Divider } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { getWebLink, getFilenameOnly } from '../utils';
import UploadDialog from './UploadDialog';

export default function DocumentListView({ groupedDocs, onDelete, onSummarize, onRefresh }) {
    const [uploadOpen, setUploadOpen] = useState(false);

    return (
        <Paper className="p-2">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Ingested Documents ({Object.keys(groupedDocs).length})</Typography>
                <Button 
                    variant="contained" 
                    startIcon={<CloudUploadIcon />}
                    onClick={() => setUploadOpen(true)}
                >
                    Upload Documents
                </Button>
            </Box>

            {Object.keys(groupedDocs).length === 0 ? (
                <Alert severity="info">No documents found. Upload some documents to get started.</Alert>
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
                                            data-testid={`summarize-btn-${filename}`}
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

            <UploadDialog 
                open={uploadOpen} 
                onClose={() => setUploadOpen(false)}
                onUploadComplete={() => {
                    if (onRefresh) onRefresh();
                }}
            />
        </Paper>
    );
}
