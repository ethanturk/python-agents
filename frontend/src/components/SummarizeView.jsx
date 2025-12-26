import React, { useState } from 'react';
import { Paper, Typography, Box, FormControl, InputLabel, Select, MenuItem, Button, Divider } from '@mui/material';
import SummarizeIcon from '@mui/icons-material/Summarize';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getWebLink, getFilenameOnly } from '../utils';

export default function SummarizeView({ groupedDocs, onSummarize, summaryResult, loading }) {
    const [selectedDoc, setSelectedDoc] = useState('');

    const handleSummarizeClick = () => {
        if (selectedDoc) {
            onSummarize(selectedDoc);
        }
    };

    return (
        <Paper className="p-4">
            <Typography variant="h5" gutterBottom>Summarize Document</Typography>
            <Box className="flex-gap-2 mb-4">
                <FormControl fullWidth>
                    <InputLabel>Select Document</InputLabel>
                    <Select
                        value={selectedDoc}
                        label="Select Document"
                        onChange={(e) => setSelectedDoc(e.target.value)}
                    >
                        {Object.keys(groupedDocs).map((filename) => (
                            <MenuItem key={filename} value={filename}>
                                {getFilenameOnly(filename)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button
                    variant="contained"
                    size="large"
                    onClick={handleSummarizeClick}
                    disabled={!selectedDoc || loading}
                    startIcon={<SummarizeIcon />}
                >
                    Summarize
                </Button>
            </Box>

            {summaryResult && (
                <Box>
                    <Divider className="my-3" />
                    <Box className="flex-between mb-2">
                        <Typography variant="h6">Summary Result</Typography>
                        <Button variant="outlined" href={getWebLink(selectedDoc)} target="_blank">
                            View Original Document
                        </Button>
                    </Box>
                    <Paper elevation={3} className="p-3 summary-paper">
                        <Box className="markdown-body markdown-summary">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryResult}</ReactMarkdown>
                        </Box>
                    </Paper>
                </Box>
            )}
        </Paper>
    );
}
