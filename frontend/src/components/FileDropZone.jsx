import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Button, List, ListItem, ListItemText, IconButton, Paper } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

export default function FileDropZone({ onFilesSelected, multiple = true }) {
  const [files, setFiles] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    // Append new files
    setFiles((prev) => {
      const newFiles = [...prev, ...acceptedFiles];
      onFilesSelected(newFiles); 
      return newFiles;
    });
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple });

  const removeFile = (fileToRemove) => {
    setFiles((prev) => {
      const newFiles = prev.filter(f => f !== fileToRemove);
      onFilesSelected(newFiles);
      return newFiles;
    });
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        variant="outlined"
        {...getRootProps()}
        sx={{
          p: 3,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragActive ? 'action.hover' : 'background.default',
          borderStyle: 'dashed',
          borderColor: isDragActive ? 'primary.main' : 'text.disabled'
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        {isDragActive ? (
          <Typography>Drop the files here ...</Typography>
        ) : (
          <Typography>Drag 'n' drop files here, or click to select files</Typography>
        )}
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            (Only regular files are supported for now)
        </Typography>
      </Paper>

      {files.length > 0 && (
        <List dense sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
          {files.map((file, index) => (
            <ListItem
              key={index}
              secondaryAction={
                <IconButton edge="end" aria-label="delete" onClick={() => removeFile(file)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <InsertDriveFileIcon sx={{ mr: 2, color: 'action.active' }} />
              <ListItemText
                primary={file.name}
                secondary={`${(file.size / 1024).toFixed(2)} KB`}
                primaryTypographyProps={{ noWrap: true }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
