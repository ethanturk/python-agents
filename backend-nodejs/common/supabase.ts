/**
 * Supabase client wrapper.
 * Provides direct access to Supabase for vector DB and operations.
 */

import { createClient } from "@supabase/supabase-js";
import type { SearchResult } from "./types";
import { config } from "./config";
import logger from "./logger";

// Lazy Supabase client initialization
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
      // For tests, return a mock client that throws on operations
      const mock = createClient("https://mock.supabase.co", "mock-key");
      return mock;
    }
  }
  return supabase;
}

/**
 * Perform vector search on documents using Supabase RPC function.
 * @param queryEmbedding - Query embedding vector
 * @param threshold - Similarity threshold (0-1)
 * @param matchCount - Maximum number of results
 * @param documentSet - Filter by document set (optional)
 */
export async function matchDocuments(
  queryEmbedding: number[],
  threshold: number = 0.7,
  matchCount: number = 10,
  documentSet: string = "all",
): Promise<SearchResult[]> {
  try {
    const { data, error } = await getSupabase().rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: matchCount,
      filter_document_set: documentSet,
    });

    if (error) {
      logger.error({ error: error.message }, "Supabase RPC error");
      return [];
    }

    if (!data) {
      logger.warn("No data returned from match_documents");
      return [];
    }

    // Format results to match Python implementation
    return data.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        content: (r.content as string) || "",
        filename: (r.filename as string) || "",
        document_set: (r.document_set as string) || "",
        similarity: (r.similarity as number) || 0,
        metadata: (r.metadata as Record<string, unknown>) || undefined,
      };
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Vector search error");
    return [];
  }
}

/**
 * Get distinct filenames from documents.
 * @param documentSet - Filter by document set (optional)
 */
export async function getDocuments(
  documentSet?: string,
): Promise<SearchResult[]> {
  try {
    let query = supabase
      .from(config.VECTOR_TABLE_NAME)
      .select("filename, document_set")
      .not("filename", "is", null);

    if (documentSet && documentSet !== "all") {
      query = query.eq("document_set", documentSet);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error: error.message }, "Supabase query error");
      return [];
    }

    // Aggregate by filename to get chunk counts
    const fileMap = new Map<string, { count: number; document_set: string }>();

    data?.forEach((row) => {
      const filename = row.filename as string;
      const docSet = row.document_set as string;
      if (!fileMap.has(filename)) {
        fileMap.set(filename, { count: 0, document_set: docSet });
      }
      fileMap.get(filename)!.count += 1;
    });

    // Convert to SearchResult format
    return Array.from(fileMap.entries()).map(([filename, info]) => ({
      filename,
      document_set: info.document_set,
      content: "",
      similarity: 0,
      chunk_count: info.count,
    }));
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Get documents error");
    return [];
  }
}

/**
 * Get distinct document sets.
 */
export async function getDocumentSets(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from(config.VECTOR_TABLE_NAME)
      .select("document_set")
      .not("document_set", "is", null);

    if (error) {
      logger.error({ error: error.message }, "Supabase query error");
      return [];
    }

    // Extract unique document sets
    const sets = new Set<string>();
    data?.forEach((row) => {
      const docSet = row.document_set as string;
      if (docSet) {
        sets.add(docSet);
      }
    });

    return Array.from(sets);
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Get document sets error");
    return [];
  }
}

/**
 * Delete documents by filename.
 * @param filename - Filename to delete
 * @param documentSet - Document set (optional)
 */
export async function deleteDocuments(
  filename: string,
  documentSet?: string,
): Promise<number> {
  try {
    let query = supabase
      .from(config.VECTOR_TABLE_NAME)
      .delete()
      .eq("filename", filename);

    if (documentSet && documentSet !== "all") {
      query = query.eq("document_set", documentSet);
    }

    const { error } = await query;

    if (error) {
      logger.error({ error: error.message }, "Delete documents error");
      return 0;
    }

    return 1;
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Delete documents error");
    return 0;
  }
}

export default getSupabase();
