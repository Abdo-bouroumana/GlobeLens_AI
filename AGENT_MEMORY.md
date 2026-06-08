# GlobeLens AI — Agent Memory & Project State
**Last Updated:** 2026-06-06 | **Phase:** 5 Complete (LLM Processing & Event Enrichment)

---

## 1. Project Overview

**GlobeLens AI** is an advanced news intelligence platform that:
- Scrapes RSS feeds from global media publishers (BBC, CNN, Al Jazeera, etc.)
- Groups articles into Events using vector embeddings + cosine similarity clustering
- Uses LLMs (Anthropic Claude / OpenAI GPT) to generate AI summaries, detect bias, extract geo-coordinates
- Provides a public API (FastAPI) consumed by a Next.js web frontend

**Repository root:** `c:\Users\pc\Desktop\seconde_year_cs\capston\GlobalLens_AI\`

---

## 2. Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Next.js    │───▶│  FastAPI    │───▶│ PostgreSQL  │
│  Frontend   │    │  Backend    │    │  + pgvector │
│  :3000      │    │  :8000      │    │  :5432      │
└─────────────┘    └─────────────┘    └─────────────┘
                         │                 
                    ┌────┴────┐            
               ┌───┴──┐  ┌───┴──────────┐ 
               │Redis │  │Elasticsearch │ 
               │:6379 │  │:9200         │ 
               └──────┘  └──────────────┘ 
```

### Data Pipeline (4 stages)
```
[ScraperService]      → Article.status = SCRAPED       (RSS ingestion)
[EmbeddingService]    → Article.status = EMBEDDED      (pgvector stored)
[ClusteringService]   → Article.status = CLUSTERED     (cosine similarity grouping)
[LLMService]          → Event.summary generated        (PROCESSED)
```

### Actor Roles (Authorization Matrix)
| Role | Key Permissions |
|---|---|
| GUEST | Read feed, map, reliability scores |
| AUTH_USER | + Comments, fact-check, alerts |
| JOURNALIST | + Submit/edit articles |
| ADMIN | Full access + dashboard, moderation |

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Web Framework | FastAPI 0.111 + uvicorn | Async-first, auto OpenAPI docs |
| ORM | SQLAlchemy 2.x async | asyncpg driver for FastAPI runtime |
| Migrations | Alembic 1.13.1 | psycopg2 driver for sync migration runner |
| Database | PostgreSQL 16 + pgvector | `pgvector/pgvector:pg16` Docker image |
| Vector DB | pgvector (1536-dim) | text-embedding-3-small dimensions |
| Cache | Redis Stack | CacheService + pub/sub for notifications |
| Search | Elasticsearch 8.13.4 | Single-node, xpack.security=false locally |
| LLM | Anthropic Claude / OpenAI GPT | Configurable via LLM_PROVIDER env var |
| Frontend | Next.js 14 + React 18 | Leaflet for map view, Zustand state |
| Container | Docker + Docker Compose | 5-service stack with health checks |

---

## 4. Directory Structure

```
GlobalLens_AI/
├── docker-compose.yml          # 5 services, health checks, volumes, network
├── .env / .env.example         # All environment variables
├── .gitignore
├── backend/
│   ├── Dockerfile              # Multi-stage: base → development → production
│   ├── requirements.txt        # All Python deps
│   ├── alembic.ini             # Alembic config (DB URL injected from env)
│   ├── alembic/
│   │   ├── env.py              # Imports Base.metadata, reads SYNC_DATABASE_URL
│   │   ├── script.py.mako      # Migration file template
│   │   └── versions/
│   │       └── 0001_initial_schema.py  ← HAND-AUTHORED (with pgvector ext)
│   └── app/
│       ├── main.py             # FastAPI app + lifespan + /health with DB probe
│       ├── test_clustering.py  # Clustering engine validation script
│       ├── test_embedding.py   # Embedding engine validation script
│       ├── test_scraper.py     # Playwright scraper validation script
│       ├── core/
│       │   ├── config.py       # Settings (DATABASE_URL + SYNC_DATABASE_URL)
│       │   ├── database.py     # Async engine + AsyncSession + get_db()
│       │   └── logging.py      # Structlog structured logging
│       ├── controllers/        # 8 API controllers (all blueprint endpoints)
│       │   ├── auth_controller.py      ← UPDATED (register, login, me endpoints)
│       │   └── admin_controller.py     ← UPDATED (added batch embedding and clustering processes endpoint)
│       ├── entities/
│       │   └── models.py       # All 7 ORM models + 4 enums
│       ├── schemas/
│       │   └── user.py         # Pydantic schemas (UserRegister, UserResponse, etc.)
│       ├── services/           # CacheService, EmbeddingService, LLMService, etc.
│       │   ├── auth_service.py         ← NEW (Bcrypt-hashing, authenticate, token helpers)
│       │   ├── embedding_service.py    ← UPDATED (added dynamic OpenAI/Grok support and batch worker)
│       │   └── clustering_service.py   ← UPDATED (added pgvector event clustering and new event spawning)
│       └── repositories/       # ArticleRepository, EventRepository, etc.
│           ├── user_repository.py      ← UPDATED (async create and get_by_email methods)
│           ├── article_repository.py   ← UPDATED (added get_unprocessed_articles and get_embedded_unclustered_articles)
│           ├── event_repository.py     ← UPDATED (added find_recent_events and find_closest_event_by_vector)
│           └── embedding_repository.py ← NEW (added create_embedding with atomic parent update)
├── frontend/
│   ├── Dockerfile              # Multi-stage: base → dev → builder → production
│   ├── package.json            # Next.js 14, React Query, Zustand, Leaflet
│   ├── next.config.js          # Standalone output + /api proxy rewrite
│   └── src/app/
│       ├── layout.tsx          # Root layout + SEO + Inter font
│       ├── globals.css         # Design tokens
│       └── page.tsx            # Branded placeholder showing service statuses
└── scripts/
    └── init-db.sql             # Auto-runs CREATE EXTENSION vector; on first startup
```

---

## 5. Phase Completion Status

### ✅ Phase 0: Docker Environment (COMPLETE)
- `docker-compose.yml` with all 5 services
- `depends_on: condition: service_healthy` chain: db/cache/search → backend → frontend
- Named volumes: `postgres_data`, `redis_data`, `elasticsearch_data`
- pgvector Docker image: `pgvector/pgvector:pg16`

### ✅ Phase 1: Database Foundation (COMPLETE)
- **`backend/app/core/database.py`** — Async SQLAlchemy engine + `AsyncSessionFactory` + `get_db()` dependency
- **`backend/app/core/config.py`** — Added `SYNC_DATABASE_URL` property (asyncpg → psycopg2 driver swap) for Alembic
- **`backend/app/main.py`** — Lifespan wired to engine warm-up + dispose; `/health` now does live DB probe
- **`backend/alembic.ini`** — Timestamp-based filenames, UTC timezone, placeholder URL overridden in env.py
- **`backend/alembic/env.py`** — Reads `SYNC_DATABASE_URL`, imports `Base.metadata`, supports offline/online modes
- **`backend/alembic/versions/0001_initial_schema.py`** — Hand-authored migration:
  - Step 1: `CREATE EXTENSION vector; uuid-ossp; pg_trgm;` — **BEFORE** any tables
  - Step 2: Creates all 4 ENUM types safely with `DO/EXCEPTION` blocks
  - Step 3: Creates all 7 tables in FK-dependency order
  - Step 4: IVFFlat vector index for ANN similarity search (`lists=100`)

### ✅ Phase 2: Authentication & User Management (COMPLETE)
- **`backend/app/schemas/user.py`** — Created data validation and API filters for requests and responses.
- **`backend/app/repositories/user_repository.py`** — Extended repository with asynchronous methods to retrieve (`get_by_email`) and create (`create`) users using ORM.
- **`backend/app/services/auth_service.py`** — Built the business logic core incorporating native `bcrypt` cryptographic hashing and `python-jose` for JWT creation and validation.
- **`backend/app/controllers/auth_controller.py`** — Tied validation schemas, repository functions, and JWT tokens together. Implemented `get_current_user` dependency injection for checking token validity and blocking state.
- **Integration Validation** — Created an automated testing script (`C:\Users\pc\.gemini\antigravity\brain\59a504ea-e758-48ee-823e-342fa8f7ba43/scratch/test_auth.py`) verifying signups, logins, duplicate rejections, invalid login blockages, and profile retrieval.

### ✅ Phase 3: Hybrid Ingestion Pipeline (COMPLETE)
- **`backend/app/repositories/article_repository.py`** — Added `create_scraped_article` with URL idempotency validation and status initialization to `SCRAPED`.
- **`backend/app/services/scraper_service.py`** — Implemented RSS discovery (`fetch_rss_links`) and headless Playwright Chromium page hydration + BeautifulSoup text extraction (`extract_full_content`) for BBC, CNN, and Al Jazeera.
- **`backend/app/controllers/article_controller.py`** — Updated endpoint `POST /sync` with Admin/Journalist Role-Based Access Control and non-blocking background orchestration using FastAPI's `BackgroundTasks`.
- **Scraper Testing Integration** — Built `test_scraper.py` functional suite confirming security, async extraction, and database persistence. Tested live and confirmed new dynamically hydrated articles successfully scrape and store.

### ✅ Phase 4a: The Embedding Engine & Vectorization (COMPLETE)
- **`backend/app/core/config.py`** — Added `GROK_API_KEY` settings and integrated `'grok'` under `LLM_PROVIDER` for x.AI-compatible client configurations.
- **`backend/app/repositories/article_repository.py`** — Created `get_unprocessed_articles(self, limit: int)` to query articles stuck in `SCRAPED` status.
- **`backend/app/repositories/embedding_repository.py`** — Created repository that writes embedding float vectors to the `embeddings` table and transitions the parent article state to `EMBEDDED` within an atomic transaction.
- **`backend/app/services/embedding_service.py`** — Implemented the `EmbeddingService` dynamically switching between OpenAI and Grok (x.AI) APIs. Configured standard vector dimensions (1536) using `grok-beta` or `text-embedding-3-small` models, backed by `cache_service` and batch execution isolation.
- **`backend/app/controllers/admin_controller.py`** — Exposed `POST /api/v1/admin/embed/process` route restricted to `ADMIN` users that invokes the batch processor asynchronously via FastAPI's `BackgroundTasks`.
- **Integration Validation** — Verified functionality using `test_embedding.py` proving security rules, JWT resolution, batch updates, and vector persistence.

### ✅ Phase 4b: Clustering & Event Grouping (COMPLETE)
- **`backend/app/repositories/event_repository.py`** — Added `find_recent_events` and `find_closest_event_by_vector` employing pgvector's cosine distance operator (`<=>` / `cosine_distance`) to detect matching event groups within a 72-hour sliding window.
- **`backend/app/repositories/article_repository.py`** — Added `get_embedded_unclustered_articles` utilizing SQLAlchemy `joinedload` to eagerly load article vector embeddings.
- **`backend/app/services/clustering_service.py`** — Implemented the `ClusteringService` which reads `EMBEDDED` articles, compares them using pgvector distance, and atomically links them to an existing event or spawns a new event cluster.
- **`backend/app/controllers/admin_controller.py`** — Added `POST /api/v1/admin/cluster/process` endpoint restricted to `ADMIN` users that invokes the clustering worker asynchronously via FastAPI's `BackgroundTasks`.
- **Clustering Verification** — Designed and executed `test_clustering.py` end-to-end integration test validating RBAC rules, vector similarity classification thresholding (distance < 0.18), existing event merging, and new event creation.

### ✅ Phase 5: LLM Processing & Event Enrichment (COMPLETE)
- **`backend/app/schemas/intelligence.py`** — Created `EventIntelligenceResponse` to validate LLM JSON structure (objective synthesis, min 3 paragraphs, coordinate & score bounds).
- **`backend/app/repositories/event_repository.py`** — Added `get_unprocessed_events` and `update_event_intelligence` supporting `Union[dict, EventIntelligenceResponse]` to atomically update event metadata, mark status as `'PROCESSED'`, and propagate article status to `PROCESSED`.
- **`backend/app/services/llm_service.py`** — Implemented `LLMService` supporting dynamic AsyncOpenAI client targeting Grok (`grok-beta`) or OpenAI (`gpt-4o-mini`). Synthesizes article clusters and updates database dynamically.
- **`backend/app/controllers/admin_controller.py`** — Exposed `POST /api/v1/admin/llm/process` route restricted to `ADMIN` role using `BackgroundTasks`.
- **Integration Validation** — Verified via `test_llm_processing.py` confirming JSON output parsing, database persistence, status propagation, and API security.

### 🔜 Phase 6: Elasticsearch Search
- Index mapping creation on startup
- `SearchRepository.index()` called after Event is PROCESSED
- Full-text search + autocomplete suggestions

### 🔜 Phase 7: Frontend UI
- Replace placeholder page with full Next.js UI
- Map view with Leaflet for geo-tagged events
- Auth pages (login/register)
- Event feed + event detail pages

---

## 6. Critical Engineering Decisions

### A. Async Driver Split (DATABASE_URL vs SYNC_DATABASE_URL)
- **FastAPI runtime** uses `postgresql+asyncpg://` — non-blocking, ~4x faster than psycopg2
- **Alembic migrations** use `postgresql+psycopg2://` — required because Alembic is synchronous
- The `SYNC_DATABASE_URL` property in `Settings` swaps drivers automatically — single source of truth for host/credentials

### B. pgvector Extension Before Table Creation
- The `vector` type is provided by the pgvector PostgreSQL extension
- If `CREATE TABLE embeddings` runs before `CREATE EXTENSION vector`, PostgreSQL raises `ERROR: type "vector" does not exist`
- **Solution**: Migration `0001` installs extensions in Step 1 BEFORE any table DDL
- Also handled in `scripts/init-db.sql` for fresh container startups

### C. Hand-Authored vs Auto-Generated Migration
- The initial migration is **hand-authored** rather than `--autogenerate` because:
  - We need precise control over the extension installation order
  - IVFFlat index creation requires raw SQL (`op.execute()`)
  - ENUM types need `DO/EXCEPTION` guards for idempotency
- **Subsequent migrations** can and should use `alembic revision --autogenerate`

### D. Alembic env.py Design
- `sys.path.insert(0, ...)` makes `from app.core.config import settings` work without installing the package
- `import app.entities.models` ensures ALL models are registered in `Base.metadata` (prevents "no changes detected" during autogenerate)
- `config.set_main_option("sqlalchemy.url", settings.SYNC_DATABASE_URL)` ensures DB URL is never hardcoded in alembic.ini

### E. Session Management
- `expire_on_commit=False` prevents `MissingGreenlet` errors in async SQLAlchemy
- `autoflush=False` gives explicit control over when SQL is emitted
- `get_db()` commits on success, rolls back on any exception, always closes

### F. Health Check
- `/health` performs a live `SELECT 1` against the DB, reports `database: "ok"` or `"error: <msg>"`
- This makes Docker health checks meaningful — they verify DB reachability, not just process liveness

### G. Native Bcrypt Cryptography (Compatibility Fix)
- Testing revealed a `ValueError` bug in `passlib` on Python 3.12 (specifically crash during `passlib.context.CryptContext` decryption logic when verifying passwords).
- **Solution**: Migrated cryptography helpers to import and utilize the native Python `bcrypt` library directly (`bcrypt.hashpw` and `bcrypt.checkpw`). This bypassed the deprecated and buggy passlib handlers while maintaining maximum security, clean encoding, and Python 3.12 runtime stability.

### H. Playwright Debian Trixie Compatibility (Ingestion Fix)
- Testing revealed that the docker container OS is Debian Trixie (testing). Playwright's automatic dependency installation falls back to Ubuntu 20.04 which fails due to missing package names.
- **Solution**: Manually executed `apt-get install` inside the container for the required rendering and audio system packages (`libglib2.0-0`, `libnss3`, `libnspr4`, etc.) allowing Chromium to execute in headless mode properly.

---

## 7. Migration Commands Reference

```bash
# Enter backend container
docker exec -it globelens_backend bash

# Check current migration state
alembic current

# Apply all pending migrations (first run populates the DB)
alembic upgrade head

# Auto-generate a new migration after modifying models.py
alembic revision --autogenerate -m "describe_your_change"

# Apply the new migration
alembic upgrade head

# Roll back last migration
alembic downgrade -1

# View migration history
alembic history --verbose
```

---

## 8. Environment Variables Summary

| Variable | Default | Used By |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://globelens:...@db:5432/globelens_db` | FastAPI async engine |
| `REDIS_URL` | `redis://:redis_secret@cache:6379/0` | CacheService |
| `ELASTICSEARCH_URL` | `http://search:9200` | SearchRepository |
| `ANTHROPIC_API_KEY` | *(must set)* | LLMService |
| `OPENAI_API_KEY` | *(must set for embeddings)* | EmbeddingService |
| `GROK_API_KEY` | *(must set for grok embedding/LLM)* | EmbeddingService / LLMService |
| `SECRET_KEY` | *(must change in prod)* | JWT signing |
| `LLM_PROVIDER` | `anthropic` | LLM/Embedding provider selection ("anthropic" / "openai" / "grok") |

---

## 9. Open Issues / Gotchas & Fixes

1. **CORS Env Parsing [FIXED]** — Standard list-based variables from the environment like `CORS_ORIGINS=http://localhost:3000` crashed `pydantic-settings` because they were parsed as invalid JSON complex fields. We resolved this by defining `CORS_ORIGINS: Any` in `config.py` and writing a custom parser in `@field_validator("CORS_ORIGINS", mode="before")` that correctly accepts comma-separated, JSON list, or bare string formats.

2. **Frontend `npm ci` Failures [FIXED]** — Because no initial `package-lock.json` existed in the codebase, the frontend Dockerfile's `npm ci` command failed during the first-time stack build. We resolved this by changing `npm ci` to `npm install` inside the frontend `Dockerfile`, which successfully installs packages and generates the lockfile inside the container.

3. **PostgreSQL Enum Duplicate DDL [FIXED]** — Step 2 of the initial migration manually creates all custom Postgres Enum types for idempotence. This caused the subsequent `op.create_table()` columns defined as generic `sa.Enum` to crash the migration with a `DuplicateObject: type "biaslean" already exists` error since they re-issued `CREATE TYPE` queries. We resolved this by changing the columns to dialect-specific `postgresql.ENUM(..., create_type=False)`, preventing duplicate SQL compiling.

4. **Passlib Python 3.12 Compatibility [FIXED]** — Due to the `ValueError: password cannot be longer than 72 bytes` bug in `passlib` on Python 3.12 (caused by old `ctypes` mappings), we replaced the `passlib` library wrapper with direct import and configuration of the standard `bcrypt` library.

5. **docker-compose.yml `version` key warning** — Compose V2 shows a deprecation warning for the top-level `version: "3.9"` key. This is harmless but can be removed.

6. **pgvector IVFFlat index** — Requires the table to have data to train properly. An empty `embeddings` table will create the index structure but clustering will be trivial. Rebuild with `REINDEX INDEX ix_embeddings_vector_ivfflat` after inserting >1000 rows.

7. **Celery not yet configured** — `requirements.txt` includes Celery but no `celery.py` worker file or task definitions exist yet. Needed for Phase 3 async scraping jobs.

8. **sqlalchemy.exc.MissingGreenlet when querying Sources [FIXED]** — In `scraper_service.py`, accessing `source.name` and `source.url` after database sessions committed in previous loop iterations raised a `MissingGreenlet` error because the ORM objects were expired and triggered implicit synchronous lazy-loading in an async context. We resolved this by projecting the list of sources into a clean, detached list of simple Python dictionaries on fetch, completely bypassing ORM dependency tracking during the loops.
