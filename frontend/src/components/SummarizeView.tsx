import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Trash2,
  FileText,
  Loader2,
  FileText as SummarizeIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWebLink, getFilenameOnly } from "@/lib/utils";

interface ChunkData {
  document_set?: string;
  chunk_count?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface SummarizeViewProps {
  groupedDocs: Record<string, ChunkData[]>;
  onSummarize: (filename: string) => void;
  summaryResult?: string;
  loading: boolean;
  selectedDoc?: string;
  setSelectedDoc: (filename: string) => void;
  chatHistory: ChatMessage[];
  onSendChat: (message: string) => void;
  chatLoading: boolean;
  cachedSummaries?: Record<string, string>;
  onSelectCachedSummary: (filename: string) => void;
  onDeleteCachedSummary: (filename: string) => void;
  activeSummaries?: string[];
}

export default function SummarizeView({
  groupedDocs,
  onSummarize,
  summaryResult,
  loading,
  selectedDoc,
  setSelectedDoc,
  chatHistory,
  onSendChat,
  chatLoading,
  cachedSummaries,
  onSelectCachedSummary,
  onDeleteCachedSummary,
  activeSummaries = [],
}: SummarizeViewProps) {
  const [question, setQuestion] = useState("");

  const handleSummarizeClick = () => {
    if (selectedDoc) {
      onSummarize(selectedDoc);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    onSendChat(question);
    setQuestion("");
  };

  const isInternalLoading = loading;
  const isAsyncProcessing =
    selectedDoc && activeSummaries.includes(selectedDoc);
  const showSpinner = isInternalLoading || isAsyncProcessing;

  return (
    <Card className="p-4">
      <h2 className="text-xl font-semibold mb-4">Summarize Document</h2>
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <Select value={selectedDoc || ""} onValueChange={setSelectedDoc}>
            <SelectTrigger>
              <SelectValue placeholder="Select Document" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(groupedDocs).map((filename) => (
                <SelectItem key={filename} value={filename}>
                  {getFilenameOnly(filename)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="lg"
          onClick={handleSummarizeClick}
          disabled={!selectedDoc || showSpinner}
          className="min-w-[150px]"
        >
          {showSpinner ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Summarizing...
            </>
          ) : (
            <>
              <SummarizeIcon className="mr-2 h-4 w-4" />
              Summarize
            </>
          )}
        </Button>
      </div>

      {cachedSummaries && Object.keys(cachedSummaries).length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">
            Recent Local Summaries
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(cachedSummaries).map((filename) => (
              <Badge
                key={filename}
                variant={selectedDoc === filename ? "default" : "outline"}
                className="cursor-pointer pr-8 hover:bg-accent"
                onClick={() => onSelectCachedSummary(filename)}
              >
                {getFilenameOnly(filename)}
                {selectedDoc === filename && (
                  <Trash2
                    className="ml-2 h-3 w-3 text-destructive hover:text-destructive/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCachedSummary(filename);
                    }}
                  />
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {showSpinner && (
        <div className="flex flex-col items-center justify-center my-4 p-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin mb-2" />
          <p className="text-muted-foreground">Summarization in progress...</p>
          <p className="text-sm text-muted-foreground">
            This may take a few moments. You will be notified when it's ready.
          </p>
        </div>
      )}

      {!showSpinner && summaryResult && (
        <div>
          <div className="border-t my-4" />
          <div className="flex justify-between mb-2">
            <h3 className="text-lg font-semibold">Summary Result</h3>
            <Button variant="outline" size="sm" asChild>
              <a
                href={getWebLink(selectedDoc || "")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="mr-2 h-4 w-4" />
                View Original Document
              </a>
            </Button>
          </div>
          <Card className="p-4">
            <div className="markdown-body markdown-summary prose dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summaryResult}
              </ReactMarkdown>
            </div>
          </Card>

          <div className="summary-chat-container mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Chat with Summary</h3>

            <div className="summary-chat-history space-y-4">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground ml-8"
                      : "bg-muted mr-8"
                  }`}
                >
                  <div className="markdown-body prose dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="p-4 rounded-lg bg-muted mr-8">
                  <p className="text-sm">Thinking...</p>
                </div>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2 mt-4">
              <Input
                placeholder="Ask a question about this summary..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={chatLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={chatLoading || !question.trim()}
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
