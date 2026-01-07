-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the table to store documents and their embeddings
-- Adjust the vector dimensions (768) if using a different model (e.g. 1536 for OpenAI text-embedding-3-small)
create table if not exists documents (
  id uuid primary key,
  vector vector(768),
  filename text,
  document_set text,
  content text,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Create indexes for faster searching
create index if not exists documents_vector_idx
  on documents
  using hnsw (vector vector_cosine_ops);

create index if not exists idx_filename on documents (filename);
create index if not exists idx_document_set on documents (document_set);

-- Create the RPC function for similarity search via Supabase REST API
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_document_set text
)
returns table (
  id uuid,
  content text,
  filename text,
  document_set text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.filename,
    documents.document_set,
    documents.metadata,
    1 - (documents.vector <=> query_embedding) as similarity
  from documents
  where 1 - (documents.vector <=> query_embedding) > match_threshold
  and (filter_document_set is null or documents.document_set = filter_document_set)
  order by documents.vector <=> query_embedding
  limit match_count;
end;
$$;
