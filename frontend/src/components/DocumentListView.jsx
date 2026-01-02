import React, { useState, useMemo, memo } from 'react';
import { Paper, Typography, Box, Alert, Accordion, AccordionSummary, AccordionDetails, Button, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { getWebLink, getFilenameOnly } from '../utils';
import UploadDialog from './UploadDialog';
import { useDocumentSet } from '../contexts/DocumentSetContext';

const DocumentRow = memo(({ filename, chunks, onSummarize, onDelete }) => {
    return (
        <Accordion variant="outlined" sx={{ mb: 1 }}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                className="custom-accordion-summary"
            >
                <Box className="document-row" sx={{ alignItems: 'center', width: '100%' }}>
                    <Typography
                        variant="body1"
                        noWrap
                        className="document-filename"
                        title={filename}
                        sx={{ flexGrow: 1, mr: 2 }}
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
                            data-testid={`delete-btn-${filename}`}
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
    );
});

export default function DocumentListView({ groupedDocs, onDelete, onSummarize, onRefresh }) {
    const [uploadOpen, setUploadOpen] = useState(false);
    const { selectedSet } = useDocumentSet();

    // Group documents by document_set
    const docsBySet = useMemo(() => {
        const groups = {};
        Object.entries(groupedDocs).forEach(([filename, chunks]) => {
            const docSet = chunks[0]?.document_set || 'default';
            if (!groups[docSet]) groups[docSet] = [];
            groups[docSet].push({ filename, chunks });
        });
        
        // Sort sets alphabetically
        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key].sort((a, b) => a.filename.localeCompare(b.filename));
            return acc;
        }, {});
    }, [groupedDocs]);

    return (
        <Paper className="p-2">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Your Documents ({Object.keys(groupedDocs).length})</Typography>
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
                    {Object.entries(docsBySet).map(([set, docs]) => (
                        <Accordion key={set} defaultExpanded={selectedSet === set || selectedSet === 'all'}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{ bgcolor: 'action.hover' }}
                            >
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                    {set} ({docs.length})
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {docs.map(({ filename, chunks }) => (
                                    <DocumentRow
                                        key={filename}
                                        filename={filename}
                                        chunks={chunks}
                                        onSummarize={onSummarize}
                                        onDelete={onDelete}
                                    />
                                ))}
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
