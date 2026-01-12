import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/config";
import FileDropZone from "./FileDropZone";
import { DocumentSetAutocomplete } from "./DocumentSetAutocomplete";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface SuccessData {
  count: number;
  documentSet: string;
  isNewSet: boolean;
}

export default function UploadDialog({
  open,
  onClose,
  onUploadComplete,
}: UploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentSets, setDocumentSets] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState("");
  const [loadingSets, setLoadingSets] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  useEffect(() => {
    if (open) {
      fetchDocumentSets();
      setSelectedFiles([]);
      setError(null);
      setSelectedSet("");
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

    if (!selectedSet || selectedSet.trim() === "") {
      setError("Please select or enter a Document Set.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("document_set", selectedSet);

    try {
      await axios.post(`${API_BASE}/agent/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const isNew = !documentSets.includes(selectedSet);
      setSuccessData({
        count: selectedFiles.length,
        documentSet: selectedSet,
        isNewSet: isNew,
      });

      onUploadComplete();
    } catch (err: any) {
      console.error("Upload failed", err);
      setError(
        err.response?.data?.detail || "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleCloseSuccess = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={!uploading ? onClose : undefined}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Select files and assign them to a document set
          </DialogDescription>
        </DialogHeader>

        {successData ? (
          <div className="space-y-4 py-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Upload Successful!</AlertDescription>
            </Alert>
            <div className="text-center space-y-2">
              <p>
                <strong>{successData.count}</strong> file(s) have been uploaded.
              </p>
              <p>
                Document Set: <strong>{successData.documentSet}</strong>
                {successData.isNewSet && (
                  <span className="ml-2 text-xs text-green-500 border border-green-500 rounded px-2 py-1">
                    NEW
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Documents are scheduled for indexing and will be available
                shortly.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                Document Set
              </label>
              <DocumentSetAutocomplete
                documentSets={documentSets}
                value={selectedSet}
                onChange={setSelectedSet}
                loading={loadingSets}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Select existing or type a new one to create it
              </p>
            </div>

            <FileDropZone onFilesSelected={setSelectedFiles} />
          </div>
        )}

        <DialogFooter>
          {successData ? (
            <Button onClick={handleCloseSuccess}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
