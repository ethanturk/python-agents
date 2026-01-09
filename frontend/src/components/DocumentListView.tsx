import React, { useState, useMemo, memo } from "react";
import {
  ChevronDown,
  Trash2,
  FileText,
  FileText as SummarizeIcon,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getWebLink, getFilenameOnly } from "@/lib/utils";
import UploadDialog from "./UploadDialog";
import { useDocumentSet } from "../contexts/DocumentSetContext";

interface ChunkData {
  document_set?: string;
  chunk_count?: number;
}

interface DocumentRowProps {
  filename: string;
  chunks: ChunkData[];
  onSummarize: (filename: string) => void;
  onDelete: (filename: string, docSet?: string) => void;
}

const DocumentRow = memo(
  ({ filename, chunks, onSummarize, onDelete }: DocumentRowProps) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <Card className="mb-2">
        <div
          className="flex items-center p-3 pr-4 cursor-pointer hover:bg-muted/50"
          onClick={() => setExpanded(!expanded)}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="mr-10"
            aria-label={
              expanded ? "Collapse document details" : "Expand document details"
            }
            aria-expanded={expanded}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                expanded ? "rotate-180" : "rotate-0"
              }`}
            />
          </Button>

          <div className="flex items-center w-full overflow-hidden">
            <p className="font-medium truncate flex-1 mr-2" title={filename}>
              {getFilenameOnly(filename)}
            </p>
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={getWebLink(filename)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSummarize(filename);
                }}
                data-testid={`summarize-btn-${filename}`}
              >
                <SummarizeIcon className="mr-2 h-4 w-4" />
                Summarize
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  const docSet = chunks[0]?.document_set;
                  onDelete(filename, docSet);
                }}
                data-testid={`delete-btn-${filename}`}
                aria-label={`Delete ${getFilenameOnly(filename)}`}
                title={`Delete ${getFilenameOnly(filename)}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
        {expanded && (
          <div className="border-t p-3">
            <p className="text-sm font-medium mb-1 text-secondary">
              Full Path: {filename}
            </p>
            <p className="text-sm text-muted-foreground">
              {chunks[0]?.chunk_count || chunks.length} chunks indexed.
            </p>
          </div>
        )}
      </Card>
    );
  },
);

interface DocumentListViewProps {
  groupedDocs: Record<string, ChunkData[]>;
  onDelete: (filename: string, docSet?: string) => void;
  onSummarize: (filename: string) => void;
  onRefresh: () => void;
}

export default function DocumentListView({
  groupedDocs,
  onDelete,
  onSummarize,
  onRefresh,
}: DocumentListViewProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { selectedSet } = useDocumentSet();

  const docsBySet = useMemo(() => {
    const groups: Record<
      string,
      Array<{ filename: string; chunks: ChunkData[] }>
    > = {};
    Object.entries(groupedDocs).forEach(([filename, chunks]) => {
      const docSet = chunks[0]?.document_set || "default";
      if (!groups[docSet]) groups[docSet] = [];
      groups[docSet].push({ filename, chunks });
    });

    return Object.keys(groups)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = groups[key].sort((a, b) =>
            a.filename.localeCompare(b.filename),
          );
          return acc;
        },
        {} as typeof groups,
      );
  }, [groupedDocs]);

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          Your Documents ({Object.keys(groupedDocs).length})
        </h2>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Documents
        </Button>
      </div>

      {Object.keys(groupedDocs).length === 0 ? (
        <Alert>
          <AlertDescription>
            No documents found. Upload some documents to get started.
          </AlertDescription>
        </Alert>
      ) : (
        <div>
          {Object.entries(docsBySet).map(([set, docs]) => {
            const isExpanded = selectedSet === "all" || selectedSet === set;

            return (
              <Accordion
                key={set}
                type="single"
                collapsible
                value={isExpanded ? set : ""}
              >
                <AccordionItem value={set}>
                  <AccordionTrigger
                    className={`px-3 ${isExpanded ? "bg-muted/50" : ""}`}
                  >
                    <h3 className="font-semibold">
                      {set} ({docs.length})
                    </h3>
                  </AccordionTrigger>
                  <AccordionContent>
                    {docs.map(({ filename, chunks }) => (
                      <DocumentRow
                        key={filename}
                        filename={filename}
                        chunks={chunks}
                        onSummarize={onSummarize}
                        onDelete={onDelete}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          })}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </Card>
  );
}
