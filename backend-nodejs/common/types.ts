/**
 * TypeScript types and interfaces for Node.js serverless functions.
 * Ported from Python Pydantic models.
 */

// Agent API Types
export interface AgentRequest {
  prompt: string;
}

export interface AgentResponse {
  response: string;
}

export interface SearchRequest {
  prompt: string;
  limit?: number;
  document_set?: string;
}

export interface SearchResult {
  content: string;
  filename: string;
  document_set: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface TaskResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: unknown;
}

// Documents API Types
export interface DocumentMetadata {
  id?: string;
  filename: string;
  document_set: string;
  chunk_count?: number;
}

export interface DocumentListResponse {
  documents: DocumentMetadata[];
}

export interface DocumentSet {
  name: string;
}

export interface DocumentSetsResponse {
  document_sets: string[];
}

// Summaries API Types
export interface Summary {
  id: number;
  filename: string;
  summary: string;
  created_at: string;
}

export interface SummariesResponse {
  summaries: Summary[];
}

export interface SummaryQARequest {
  filename: string;
  question: string;
}

export interface SearchQARequest {
  question: string;
  document_set?: string;
}

// Notifications API Types
export interface Notification {
  id: number;
  timestamp: number;
  data: NotificationData;
}

export interface NotificationData {
  type: 'ingestion' | 'summarization';
  filename?: string;
  status: 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface NotificationRequest {
  type: string;
  filename?: string;
  status: string;
  result?: string;
  error?: string;
}

export interface PollResponse {
  messages: Notification[];
}

// User Types (from Firebase)
export interface User {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

// Error Response Type
export interface ErrorResponse {
  detail: string;
}

// Health Response Type
export interface HealthResponse {
  status: 'ok';
}
