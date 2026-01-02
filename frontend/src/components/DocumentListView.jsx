import React, { useState } from 'react';
import { Paper, Typography, Box, Alert, Accordion, AccordionSummary, AccordionDetails, Button, IconButton, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { getWebLink, getFilenameOnly } from '../utils';
import UploadDialog from './UploadDialog';

function stringToColor(string) {
  let hash = 0;
  let i;

  /* eslint-disable no-bitwise */
  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = '#';

  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */

  return color;
}

export default function DocumentListView({ groupedDocs, onDelete, onSummarize, onRefresh }) {
    const [uploadOpen, setUploadOpen] = useState(false);

    // Sort documents by document_set then filename
    const sortedEntries = Object.entries(groupedDocs).sort((a, b) => {
        const setA = a[1][0]?.document_set || 'default';
        const setB = b[1][0]?.document_set || 'default';
        if (setA !== setB) return setA.localeCompare(setB);
        return a[0].localeCompare(b[0]);
    });

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
                    {sortedEntries.map(([filename, chunks]) => {
                        const docSet = chunks[0]?.document_set || 'default';
                        const chipColor = stringToColor(docSet);
                        
                        return (
                        <Accordion key={filename}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                className="custom-accordion-summary"
                                component="div"
                            >
                                <Box className="document-row" sx={{ alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                                        <Chip 
                                            label={docSet} 
                                            size="small" 
                                            sx={{ 
                                                mr: 2, 
                                                bgcolor: chipColor, 
                                                color: '#fff',
                                                fontWeight: 'bold',
                                                textShadow: '0 0 2px rgba(0,0,0,0.5)'
                                            }} 
                                        />
                                        <Typography
                                            variant="body1"
                                            noWrap
                                            className="document-filename"
                                            title={filename}
                                        >
                                            {getFilenameOnly(filename)}
                                        </Typography>
                                    </Box>
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
                    )})}
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
