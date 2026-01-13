import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { CloudUpload, X, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
}

export default function FileDropZone({
  onFilesSelected,
  multiple = true,
}: FileDropZoneProps) {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Append new files
      setFiles((prev) => {
        const newFiles = [...prev, ...acceptedFiles];
        onFilesSelected(newFiles);
        return newFiles;
      });
    },
    [onFilesSelected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
  });

  const removeFile = (fileToRemove: File) => {
    setFiles((prev) => {
      const newFiles = prev.filter((f) => f !== fileToRemove);
      onFilesSelected(newFiles);
      return newFiles;
    });
  };

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${
            isDragActive
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 bg-muted/30"
          }
        `}
      >
        <input {...getInputProps()} />
        <CloudUpload className="mx-auto h-12 w-12 text-foreground/70 mb-4" />
        {isDragActive ? (
          <p className="text-primary font-medium">Drop the files here ...</p>
        ) : (
          <div>
            <p className="text-lg font-medium mb-2 text-foreground">
              Drag &apos;n&apos; drop files here, or click to select files
            </p>
            <p className="text-sm text-foreground/60">
              (Only regular files are supported for now)
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <Card className="p-4 bg-card border-border">
          <h4 className="font-semibold mb-3 text-card-foreground">
            Selected Files ({files.length})
          </h4>
          <ul className="space-y-2 max-h-[200px] overflow-auto">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File className="h-4 w-4 flex-shrink-0 text-foreground/60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-foreground/60">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(file)}
                  aria-label={`Remove ${file.name}`}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
