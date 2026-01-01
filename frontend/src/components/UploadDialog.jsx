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

  const [successData, setSuccessData] = useState(null);

  // Load document sets on open
  useEffect(() => {
    if (open) {
      fetchDocumentSets();
      setSelectedFiles([]);
      setError(null);
      setSelectedSet(null);
      setInputValue('');
      setSuccessData(null);
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
      
      // Determine if new set
      // It is new if it's NOT in the current documentSets list
      const isNew = !documentSets.includes(docSetToUse);

      setSuccessData({
        count: selectedFiles.length,
        documentSet: docSetToUse,
        isNewSet: isNew
      });
      
      onUploadComplete(); // Trigger refresh in parent, but don't close yet
      
    } catch (err) {
      console.error("Upload failed", err);
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleCloseSuccess = () => {
      onClose();
  };

  return (
    <Dialog open={open} onClose={!uploading ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Documents</DialogTitle>
      <DialogContent dividers>
        {successData ? (
             <Box sx={{ textAlign: 'center', py: 2 }}>
                <Alert severity="success" sx={{ mb: 3 }}>
                    Upload Successful!
                </Alert>
                <Box sx={{ mb: 2 }}>
                    <strong>{successData.count}</strong> file(s) have been uploaded.
                </Box>
                <Box sx={{ mb: 2 }}>
                    Document Set: <strong>{successData.documentSet}</strong> 
                    {successData.isNewSet && <span style={{ marginLeft: '8px', color: '#66bb6a', fontSize: '0.8em', border: '1px solid #66bb6a', borderRadius: '4px', padding: '2px 6px' }}>NEW</span>}
                </Box>
                <Box color="text.secondary">
                    Documents are scheduled for indexing and will be available shortly.
                </Box>
             </Box>
        ) : (
            <>
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
            </>
        )}
      </DialogContent>
      <DialogActions>
        {successData ? (
             <Button onClick={handleCloseSuccess} variant="contained">Close</Button>
        ) : (
            <>
                <Button onClick={onClose} disabled={uploading}>Cancel</Button>
                <Button 
                  onClick={handleUpload} 
                  variant="contained" 
                  disabled={uploading || selectedFiles.length === 0}
                >
                  {uploading ? <CircularProgress size={24} /> : "Upload"}
                </Button>
            </>
        )}
      </DialogActions>
    </Dialog>
  );
}
