import React, { useMemo, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search, FileText, Send, ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getWebLink, getFilenameOnly } from "@/lib/utils";
import { SEARCH } from "@/constants";

interface SearchResult {
  metadata: {
    filename: string;
  };
}

interface SearchData {
  answer?: string;
  results: SearchResult[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface SearchViewProps {
  query: string;
  setQuery: (query: string) => void;
  onSearch: () => void;
  searchData: SearchData;
  searchLimit: number;
  setSearchLimit: (limit: number) => void;
  loading: boolean;
  searchChatHistory: ChatMessage[];
  onSendSearchChat: (message: string) => void;
  searchChatLoading: boolean;
  validationError?: string;
}

const SearchView = memo(function SearchView({
  query,
  setQuery,
  onSearch,
  searchData,
  searchLimit,
  setSearchLimit,
  loading,
  searchChatHistory,
  onSendSearchChat,
  searchChatLoading,
  validationError,
}: SearchViewProps) {
  const uniqueFiles = useMemo(
    () => [...new Set(searchData.results.map((r) => r.metadata.filename))],
    [searchData.results],
  );

  const renderedAnswer = useMemo(
    () =>
      searchData.answer ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {searchData.answer}
        </ReactMarkdown>
      ) : null,
    [searchData.answer],
  );

  const [question, setQuestion] = useState("");

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    onSendSearchChat(question);
    setQuestion("");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search Agent Knowledge"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && onSearch()}
              className={validationError ? "border-destructive" : ""}
            />
            {validationError && (
              <p className="text-sm text-destructive mt-1">{validationError}</p>
            )}
          </div>
          <Select
            value={searchLimit.toString()}
            onValueChange={(v) => setSearchLimit(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={onSearch}
            disabled={loading}
            className="min-w-[100px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </div>
      </Card>

      {loading && (
        <div className="flex justify-center my-4">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {searchData.answer && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Generative Answer</h3>
          <div className="markdown-body markdown-search prose dark:prose-invert max-w-none">
            {renderedAnswer}
          </div>
        </Card>
      )}

      {(searchData.answer || uniqueFiles.length > 0) && (
        <Accordion
          type="single"
          collapsible
          defaultValue={searchData.answer ? "item-1" : ""}
        >
          <AccordionItem value="item-1">
            <AccordionTrigger>
              Related Documents ({uniqueFiles.length})
            </AccordionTrigger>
            <AccordionContent>
              {uniqueFiles.length === 0 ? (
                <Alert>
                  <AlertDescription>No citation sources found.</AlertDescription>
                </Alert>
              ) : (
                <ul className="space-y-3">
                  {uniqueFiles.map((filename, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{getFilenameOnly(filename)}</p>
                        <p className="text-sm text-muted-foreground">{filename}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={getWebLink(filename)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          View Document
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {searchData.results && searchData.results.length > 0 && (
        <div className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold">Chat with Search Results</h3>

          <div className="summary-chat-history space-y-4">
            {searchChatHistory.map((msg, i) => (
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
            {searchChatLoading && (
              <div className="p-4 rounded-lg bg-muted mr-8">
                <p className="text-sm">Thinking...</p>
              </div>
            )}
          </div>

          <form
            onSubmit={handleChatSubmit}
            className="flex gap-2 mt-4"
          >
            <Input
              placeholder="Ask a follow-up question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={searchChatLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={searchChatLoading || !question.trim()}
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
});

export default SearchView;
