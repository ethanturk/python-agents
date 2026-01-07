-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create test documents table
CREATE TABLE IF NOT EXISTS test_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vector vector(1536),
    filename TEXT NOT NULL,
    document_set TEXT NOT NULL DEFAULT 'test_set',
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS test_documents_vector_idx ON test_documents USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);

-- Create index for filtering
CREATE INDEX IF NOT EXISTS test_documents_filename_idx ON test_documents(filename);
CREATE INDEX IF NOT EXISTS test_documents_set_idx ON test_documents(document_set);

-- Create match_documents function for RAG searches
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector,
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_document_set text DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    filename TEXT,
    document_set TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.content,
        t.filename,
        t.document_set,
        1 - (t.vector <=> query_embedding) as similarity,
        t.metadata
    FROM test_documents t
    WHERE
        (filter_document_set IS NULL OR t.document_set = filter_document_set)
        AND (1 - (t.vector <=> query_embedding)) > match_threshold
    ORDER BY t.vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create function to delete by filename
CREATE OR REPLACE FUNCTION delete_document_by_filename(doc_filename TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM test_documents WHERE filename = doc_filename;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Create function to list documents
CREATE OR REPLACE FUNCTION list_documents(
    limit_count int DEFAULT 100,
    offset_count int DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    filename TEXT,
    content TEXT,
    document_set TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.filename,
        t.content,
        t.document_set,
        t.metadata,
        t.created_at
    FROM test_documents t
    ORDER BY t.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO test_user;

-- Insert test data for initial testing
INSERT INTO test_documents (vector, filename, document_set, content, metadata)
VALUES
    (
        '[0.1,0.2,0.3]'::vector,
        'test_document.txt',
        'test_set',
        'This is a test document for integration testing.',
        '{"test": true, "category": "unit_test"}'::jsonb
    )
ON CONFLICT DO NOTHING;
