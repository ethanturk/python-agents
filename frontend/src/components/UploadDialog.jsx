import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import axios from 'axios';
import { API_BASE } from '../config';
import FileDropZone from './FileDropZone';

export default function UploadDialog({ open, onClose, onUploadComplete }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  
  // Document Set State
  const [documentSets, setDocumentSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null); // The value for Autocomplete (can be string or option)
  const [inputValue, setInputValue] = useState(''); // Text input value
  const [loadingSets, setLoadingSets] = useState(false);

  // Load document sets on open
  useEffect(() => {
    if (open) {
      fetchDocumentSets();
      setSelectedFiles([]);
      setError(null);
      setSelectedSet(null);
      setInputValue('');
    }
  }, [open]);

  const fetchDocumentSets = async () => {
    setLoadingSets(true);
    try {
      const res = await axios.get(`${API_BASE}/agent/documentsets`);
      setDocumentSets(res.data.document_sets || []);
    } catch (e) {
      console.error("Failed to fetch document sets", e);
    } finally {
      setLoadingSets(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file.");
      return;
    }

    // Determine effective document set name
    // Autocomplete value can be null, string (if freeSolo typed), or option string
    // Here we use inputValue as the primary source if selectedSet is null, or selectedSet if valid.
    // Actually, MUI Autocomplete `freeSolo` usage:
    // `value` is the selected option (or typed string if we manage it right).
    // Let's rely on `inputValue` mostly if we want to allow typing new ones, 
    // BUT `value` prop is cleaner for selection.
    
    const docSetToUse = selectedSet || inputValue;

    if (!docSetToUse || docSetToUse.trim() === '') {
        setError("Please select or enter a Document Set.");
        return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('document_set', docSetToUse);

    try {
      await axios.post(`${API_BASE}/agent/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      onUploadComplete();
      onClose();
    } catch (err) {
      console.error("Upload failed", err);
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!uploading ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Documents</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Box sx={{ mb: 3 }}>
           <Autocomplete
              freeSolo
              options={documentSets}
              loading={loadingSets}
              value={selectedSet}
              onChange={(event, newValue) => {
                setSelectedSet(newValue);
              }}
              inputValue={inputValue}
              onInputChange={(event, newInputValue) => {
                setInputValue(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Document Set"
                  helperText="Select existing or type a new one to create it"
                  variant="outlined"
                  fullWidth
                  required
                />
              )}
            />
        </Box>

        <FileDropZone 
            onFilesSelected={setSelectedFiles} 
        />
        
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>Cancel</Button>
        <Button 
          onClick={handleUpload} 
          variant="contained" 
          disabled={uploading || selectedFiles.length === 0}
        >
          {uploading ? <CircularProgress size={24} /> : "Upload"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
