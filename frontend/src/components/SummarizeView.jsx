import React, { useState } from 'react';
import { Paper, Typography, Box, FormControl, InputLabel, Select, MenuItem, Button, Divider, TextField, IconButton } from '@mui/material';
import SummarizeIcon from '@mui/icons-material/Summarize';
import SendIcon from '@mui/icons-material/Send';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getWebLink, getFilenameOnly } from '../utils';

export default function SummarizeView({
    groupedDocs,
    onSummarize,
    summaryResult,
    loading,
    selectedDoc,
    setSelectedDoc,
    chatHistory,
    onSendChat,
    chatLoading
}) {
    const [question, setQuestion] = useState('');

    const handleSummarizeClick = () => {
        if (selectedDoc) {
            onSummarize(selectedDoc);
        }
    };

    const handleChatSubmit = (e) => {
        e.preventDefault();
        if (!question.trim()) return;
        onSendChat(question);
        setQuestion('');
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
                    disabled={!selectedDoc}
                    startIcon={<SummarizeIcon />}
                >
                    {loading ? 'Starting...' : 'Summarize'}
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

                    {/* Chat Section */}
                    <Box className="summary-chat-container">
                        <Typography variant="h6">Chat with Summary</Typography>

                        <Box className="summary-chat-history">
                            {chatHistory.map((msg, i) => (
                                <Box key={i} className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                                    <Typography variant="body1">{msg.text}</Typography>
                                </Box>
                            ))}
                            {chatLoading && <Box className="chat-bubble-ai"><Typography variant="body2">Thinking...</Typography></Box>}
                        </Box>

                        <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '8px' }}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Ask a question about this summary..."
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                disabled={chatLoading}
                            />
                            <IconButton type="submit" color="primary" size="large" disabled={chatLoading || !question.trim()}>
                                <SendIcon />
                            </IconButton>
                        </form>
                    </Box>
                </Box>
            )}
        </Paper>
    );
}
