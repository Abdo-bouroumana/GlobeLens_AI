"""Initial schema — all GlobeLens AI tables + pgvector extension

This is the HAND-AUTHORED initial migration. It differs from a pure
--autogenerate revision in one critical way:

    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

This must run BEFORE any CREATE TABLE statement that contains a Vector
column, because PostgreSQL's pgvector extension must be installed first.
If you let --autogenerate handle this, it will omit the extension and
the 'embeddings' table creation will fail with:
    ERROR: type "vector" does not exist

Revision ID: 0001
Revises: (none — this is the root migration)
Create Date: 2026-05-21 00:00:00.000000 UTC
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# pgvector import — needed to render Vector type in the upgrade() body
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector = None  # Graceful fallback for environments without pgvector

# ── Revision identifiers ──────────────────────────────────────────────────────
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # STEP 1 — Install PostgreSQL Extensions
    # =========================================================================
    # pgvector MUST be created before the embeddings table because the
    # 'vector' column type is provided by this extension.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    # =========================================================================
    # STEP 2 — Create ENUM types
    # =========================================================================
    # SQLAlchemy Enum creates pg ENUM types by default. We create them
    # explicitly here so the order is deterministic and they can be
    # referenced by multiple tables cleanly.

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE processingstatus AS ENUM (
                'SCRAPED', 'EMBEDDED', 'CLUSTERED', 'PROCESSED'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM (
                'GUEST', 'AUTH_USER', 'JOURNALIST', 'ADMIN'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE factcheckresult AS ENUM (
                'TRUE', 'FALSE', 'UNCERTAIN'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE biaslean AS ENUM (
                'LEFT', 'CENTER_LEFT', 'CENTER', 'CENTER_RIGHT', 'RIGHT'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # =========================================================================
    # STEP 3 — Create tables (dependency order: no FK references before table)
    # =========================================================================

    # ── sources ──────────────────────────────────────────────────────────────
    op.create_table(
        "sources",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("credibility_score", sa.Float, nullable=False, server_default="0.5"),
        sa.Column(
            "bias_lean",
            postgresql.ENUM(
                "LEFT", "CENTER_LEFT", "CENTER", "CENTER_RIGHT", "RIGHT",
                name="biaslean",
                create_type=False,
            ),
            nullable=False,
            server_default="CENTER",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM("GUEST", "AUTH_USER", "JOURNALIST", "ADMIN", name="userrole", create_type=False),
            nullable=False,
            server_default="AUTH_USER",
        ),
        sa.Column("is_blocked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "preferred_topics",
            postgresql.ARRAY(sa.String()),
            nullable=True,
        ),
        sa.Column(
            "preferred_countries",
            postgresql.ARRAY(sa.String()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── events ────────────────────────────────────────────────────────────────
    op.create_table(
        "events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("topic", sa.String(255), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("importance_score", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("is_promoted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_events_topic",   "events", ["topic"])
    op.create_index("ix_events_country", "events", ["country"])

    # ── articles ──────────────────────────────────────────────────────────────
    op.create_table(
        "articles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("url", sa.String(2000), nullable=False, unique=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "processing_status",
            postgresql.ENUM(
                "SCRAPED", "EMBEDDED", "CLUSTERED", "PROCESSED",
                name="processingstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="SCRAPED",
        ),
        sa.Column("is_hidden", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sources.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_articles_source_id",         "articles", ["source_id"])
    op.create_index("ix_articles_event_id",           "articles", ["event_id"])
    op.create_index("ix_articles_processing_status",  "articles", ["processing_status"])

    # ── embeddings — REQUIRES pgvector (installed in STEP 1) ─────────────────
    op.create_table(
        "embeddings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        # Vector(1536) = text-embedding-3-small dimensions
        # pgvector extension MUST already be loaded before this line
        sa.Column("vector", Vector(1536), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "article_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("articles.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
    )
    op.create_index("ix_embeddings_article_id", "embeddings", ["article_id"])

    # ── comments ──────────────────────────────────────────────────────────────
    op.create_table(
        "comments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_comments_user_id",  "comments", ["user_id"])
    op.create_index("ix_comments_event_id", "comments", ["event_id"])

    # ── fact_check_requests ───────────────────────────────────────────────────
    op.create_table(
        "fact_check_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("input_text_url", sa.Text, nullable=False),
        sa.Column(
            "result",
            postgresql.ENUM("TRUE", "FALSE", "UNCERTAIN", name="factcheckresult", create_type=False),
            nullable=True,
        ),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_fact_check_requests_user_id", "fact_check_requests", ["user_id"])

    # =========================================================================
    # STEP 4 — Create pgvector IVFFlat index for ANN similarity search
    # =========================================================================
    # IVFFlat index on the vector column dramatically speeds up approximate
    # nearest-neighbour queries used by ClusteringService.
    # lists=100 is a good starting point for datasets up to ~1M vectors.
    # Rebuild/tune this index when your dataset grows significantly.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_embeddings_vector_ivfflat
        ON embeddings
        USING ivfflat (vector vector_cosine_ops)
        WITH (lists = 100);
    """)


def downgrade() -> None:
    # Drop tables in reverse FK dependency order
    op.execute("DROP INDEX IF EXISTS ix_embeddings_vector_ivfflat;")
    op.drop_table("fact_check_requests")
    op.drop_table("comments")
    op.drop_table("embeddings")
    op.drop_table("articles")
    op.drop_table("events")
    op.drop_table("users")
    op.drop_table("sources")

    # Drop ENUM types
    op.execute("DROP TYPE IF EXISTS processingstatus;")
    op.execute("DROP TYPE IF EXISTS userrole;")
    op.execute("DROP TYPE IF EXISTS factcheckresult;")
    op.execute("DROP TYPE IF EXISTS biaslean;")

    # NOTE: We do NOT drop the pgvector extension in downgrade() because
    # other parts of the database might depend on it. Remove manually if needed.
