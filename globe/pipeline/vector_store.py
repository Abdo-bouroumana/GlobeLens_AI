"""
Vector Store Module — Qdrant
==============================
Stores article embeddings and sentence mappings in a local Qdrant instance.

Now maintains two collections:
  1. globelens_articles  — Document-level embeddings (backward compat)
  2. globelens_sentences — Sentence-level embeddings for attribution matching (§9)

Uses Qdrant's local file-based storage.
"""

import logging
import uuid
from datetime import datetime
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchAny,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from pipeline.data_models import SentenceMapping

logger = logging.getLogger(__name__)

COLLECTION_ARTICLES = "globelens_articles"
COLLECTION_SENTENCES = "globelens_sentences"
VECTOR_DIM = 1024   # BGE-M3 output dimension


class VectorStore:
    """
    Qdrant-backed vector store for GlobeLens.
    Operates in local file-based mode — no separate Qdrant server needed.
    """

    def __init__(
        self,
        storage_path: str | None = None,
        host: str = "localhost",
        port: int = 6333,
    ):
        if storage_path:
            logger.info(f"Opening local Qdrant storage at: {storage_path}")
            self.client = QdrantClient(path=storage_path)
        else:
            logger.info(f"Connecting to Qdrant server at {host}:{port}")
            self.client = QdrantClient(host=host, port=port)

        self._ensure_collections()

    # ─── collection lifecycle ────────────────────────────────────────────────

    def _ensure_collections(self) -> None:
        """Create collections and payload indices if missing."""
        existing = {c.name for c in self.client.get_collections().collections}

        # 1. Articles Collection (Legacy / Full doc search)
        if COLLECTION_ARTICLES not in existing:
            logger.info(f"Creating Qdrant collection '{COLLECTION_ARTICLES}' …")
            self.client.create_collection(
                collection_name=COLLECTION_ARTICLES,
                vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
            )
            for field in ("source", "topic", "detected_language", "bias_label"):
                self.client.create_payload_index(
                    collection_name=COLLECTION_ARTICLES,
                    field_name=field,
                    field_schema=PayloadSchemaType.KEYWORD,
                )

        # 2. Sentences Collection (Attribution / Fine-grained search)
        if COLLECTION_SENTENCES not in existing:
            logger.info(f"Creating Qdrant collection '{COLLECTION_SENTENCES}' …")
            self.client.create_collection(
                collection_name=COLLECTION_SENTENCES,
                vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
            )
            for field in ("cluster_id", "article_id", "outlet", "content_type"):
                self.client.create_payload_index(
                    collection_name=COLLECTION_SENTENCES,
                    field_name=field,
                    field_schema=PayloadSchemaType.KEYWORD,
                )

        logger.info("Collections ready.")

    # ─── Write operations ────────────────────────────────────────────────────

    def upsert_sentences(
        self,
        cluster_id: str,
        mappings: list[SentenceMapping],
        embeddings: list[list[float]],
    ) -> None:
        """
        Store sentence mappings and their embeddings for attribution matching.
        """
        if not mappings or not embeddings or len(mappings) != len(embeddings):
            logger.warning("Invalid input for upsert_sentences")
            return

        points = []
        for mapping, emb in zip(mappings, embeddings):
            payload = mapping.to_dict()
            # Add cluster_id for fast filtering during attribution
            payload["cluster_id"] = cluster_id
            
            points.append(
                PointStruct(
                    id=mapping.sentence_id,
                    vector=emb,
                    payload=payload
                )
            )

        # Batch insert
        batch_size = 100
        for i in range(0, len(points), batch_size):
            self.client.upsert(
                collection_name=COLLECTION_SENTENCES,
                points=points[i:i + batch_size],
            )
            
        logger.info(f"Stored {len(points)} sentences in {COLLECTION_SENTENCES} for cluster {cluster_id}")

    def upsert(self, article: dict[str, Any], embedding: list[float]) -> str:
        """Legacy whole-article upsert."""
        point_id = str(uuid.uuid4())
        # Clean payload logic
        payload = {k: v for k, v in article.items() if k != "embedding"}

        self.client.upsert(
            collection_name=COLLECTION_ARTICLES,
            points=[PointStruct(id=point_id, vector=embedding, payload=payload)],
        )
        return point_id

    # ─── Read operations ─────────────────────────────────────────────────────

    def search_sentences(
        self,
        query_embedding: list[float],
        cluster_id: str | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        """
        Search for sentences, optionally constrained to a specific cluster.
        Returns payload dicts including the similarity score.
        """
        must = []
        if cluster_id:
            must.append(FieldCondition(key="cluster_id", match=MatchValue(value=cluster_id)))

        query_filter = Filter(must=must) if must else None

        hits = self.client.query_points(
            collection_name=COLLECTION_SENTENCES,
            query=query_embedding,
            limit=top_k,
            query_filter=query_filter,
            with_payload=True,
        ).points

        return [{"score": round(h.score, 4), **h.payload} for h in hits]

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        **filters,
    ) -> list[dict]:
        """Legacy whole-article search."""
        must = [
            FieldCondition(key=k, match=MatchValue(value=v))
            for k, v in filters.items() if v
        ]
        query_filter = Filter(must=must) if must else None

        hits = self.client.query_points(
            collection_name=COLLECTION_ARTICLES,
            query=query_embedding,
            limit=top_k,
            query_filter=query_filter,
            with_payload=True,
        ).points

        return [{"score": round(h.score, 4), **h.payload} for h in hits]

    def count_sentences(self) -> int:
        return self.client.count(collection_name=COLLECTION_SENTENCES).count

    def count(self) -> int:
        return self.client.count(collection_name=COLLECTION_ARTICLES).count
