import React, { useState, useMemo, memo } from 'react';
import { Paper, Typography, Box, Alert, Accordion, AccordionSummary, AccordionDetails, Button, IconButton, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { getWebLink, getFilenameOnly } from '../utils';
import UploadDialog from './UploadDialog';
import { useDocumentSet } from '../contexts/DocumentSetContext';

const DocumentRow = memo(({ filename, chunks, onSummarize, onDelete }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <Paper variant="outlined" sx={{ mb: 1 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 1,
                    pr: 2,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                    sx={{ mr: 10 }}
                >
                    <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.3s' }} />
                </IconButton>

                <Box className="document-row" sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                    <Typography
                        variant="body1"
                        noWrap
                        className="document-filename"
                        title={filename}
                        sx={{ flexGrow: 1, mr: 2 }}
                    >
                        {getFilenameOnly(filename)}
                    </Typography>
                    <Box className="document-actions" sx={{ display: 'flex', flexShrink: 0 }}>
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
                                const docSet = chunks[0]?.document_set;
                                onDelete(filename, docSet);
                            }}
                            color="error"
                            size="small"
                            data-testid={`delete-btn-${filename}`}
                        >
                            <DeleteIcon />
                        </IconButton>
                    </Box>
                </Box>
            </Box>
            <Collapse in={expanded}>
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" className="mb-1 text-secondary">Full Path: {filename}</Typography>
                    <Typography variant="body2">{chunks.length} chunks indexed.</Typography>
                </Box>
            </Collapse>
        </Paper>
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
                    {Object.entries(docsBySet).map(([set, docs]) => {
                        // Controlled expansion: Expand if selectedSet matches this set OR 'all'
                        const isExpanded = selectedSet === 'all' || selectedSet === set;

                        return (
                            <Accordion
                                key={set}
                                expanded={isExpanded}
                                // We don't provide onChange here because the expansion is driven by the global filter (selectedSet)
                                // If we want to allow manual toggling while keeping it controlled, we'd need local state overrides.
                                // But based on the warning "changing default expanded state", simply fully controlling it 
                                // via props (without defaultExpanded) solves the ambiguity.
                                // If interactive collapsing is required even when filtered, we need more complex state.
                                // For now, let's assume the filter drives visibility to fix the bug simply.
                                sx={{ bgcolor: isExpanded ? 'background.paper' : 'default' }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ bgcolor: 'action.hover' }}
                                // Optional: If we want to allow toggling, we need to wire this up to change selectedSet or local state
                                // For this fix, let's stick to the filter-driven logic which seems to be the intent of "selectedSet"
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
                        );
                    })}
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
