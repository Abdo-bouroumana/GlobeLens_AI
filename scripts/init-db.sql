-- =============================================================================
-- GlobeLens AI — PostgreSQL Initialization Script
-- Runs automatically on first container startup via docker-entrypoint-initdb.d
-- =============================================================================

-- Enable the pgvector extension for vector similarity search
-- This is CRITICAL for EmbeddingService — stores 1536-dim vectors for articles
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search (optional but useful for SearchService)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extensions are loaded
DO $$
BEGIN
    RAISE NOTICE 'GlobeLens AI DB initialized successfully.';
    RAISE NOTICE 'pgvector version: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
END
$$;
