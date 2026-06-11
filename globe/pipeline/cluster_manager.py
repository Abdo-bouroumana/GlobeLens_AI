"""
Cluster Manager — Event Fingerprint Matching & Routing
=======================================================
Implements §4 of the pipeline spec.

Clusters are built around event identity, not publication date.
This solves the late-publication problem: an article published today about
an event from three days ago correctly joins the three-day-old cluster.

Cluster routing:
  • New event       → create cluster, wait for 2+ sources before synthesis
  • Active cluster  → join, flag re-synthesis
  • Closed cluster  → follow-up queue
  • Ongoing story   → parent thread with child clusters
"""

import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any

from pipeline.data_models import ClusterState, ClusterFingerprint

logger = logging.getLogger(__name__)

# Similarity threshold for fingerprint matching
# Increased from 0.25 to 0.60 to prevent unrelated articles from clustering
DEFAULT_SIMILARITY_THRESHOLD = 0.60
# Default hours before auto-close
DEFAULT_CLOSE_HOURS = 72
# Minimum sources before synthesis is triggered
MIN_SOURCES_FOR_SYNTHESIS = 2


class ClusterManager:
    """
    Manages event clusters — creation, routing, and lifecycle.
    Clusters are persisted as JSON files in a local directory.
    """

    def __init__(
        self,
        storage_dir: str,
        embedder=None,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    ):
        self.storage_dir = storage_dir
        self.embedder = embedder
        self.similarity_threshold = similarity_threshold
        os.makedirs(storage_dir, exist_ok=True)

        # Load existing clusters into memory
        self._clusters: dict[str, ClusterState] = {}
        self._load_all()
        logger.info(
            f"Cluster manager ready. {len(self._clusters)} clusters loaded "
            f"from '{storage_dir}'."
        )

    # ─── Public API ──────────────────────────────────────────────────────────

    def route(
        self,
        fingerprint_data: dict,
        article_id: str,
        outlet: str,
        sentence_ids: list[str],
    ) -> tuple[str, str]:
        """
        Route an article to the correct cluster.

        Args:
            fingerprint_data: {primary_entities, event_action, event_date}
            article_id:       Unique article identifier
            outlet:           Publication name
            sentence_ids:     List of SentenceMapping.sentence_id values

        Returns:
            Tuple of (cluster_id, routing_action) where action is:
              "new"       — new cluster created
              "active"    — joined active cluster, re-synthesis flagged
              "follow_up" — added to follow-up queue on closed cluster
        """
        # Try to match against existing clusters
        best_match_id, best_score = self._find_best_match(fingerprint_data)

        if best_match_id and best_score >= self.similarity_threshold:
            cluster = self._clusters[best_match_id]

            # Check if already in this cluster (idempotency)
            if article_id in cluster.article_ids:
                logger.info(f"Article '{article_id}' already in cluster {best_match_id}.")
                return best_match_id, "duplicate"

            # Check cluster status
            if self._is_closed(cluster):
                # Closed cluster → follow-up queue
                cluster.follow_up_queue.append(article_id)
                cluster.article_ids.append(article_id)
                cluster.sentence_ids.extend(sentence_ids)
                if outlet not in cluster.outlets:
                    cluster.outlets.append(outlet)
                cluster.source_count = len(set(cluster.outlets))
                cluster.last_updated = datetime.now(timezone.utc).isoformat()
                self._save(cluster)
                logger.info(
                    f"Article routed to FOLLOW-UP queue on cluster "
                    f"{best_match_id} (score={best_score:.3f})"
                )
                return best_match_id, "follow_up"
            else:
                # Active cluster → join and flag re-synthesis
                cluster.article_ids.append(article_id)
                cluster.sentence_ids.extend(sentence_ids)
                if outlet not in cluster.outlets:
                    cluster.outlets.append(outlet)
                cluster.source_count = len(set(cluster.outlets))
                cluster.synthesis_ready = cluster.source_count >= MIN_SOURCES_FOR_SYNTHESIS
                cluster.last_updated = datetime.now(timezone.utc).isoformat()
                # Update fingerprint with new entities
                self._merge_fingerprint(cluster.fingerprint, fingerprint_data)
                self._save(cluster)
                logger.info(
                    f"Article joined ACTIVE cluster {best_match_id} "
                    f"(score={best_score:.3f}, sources={cluster.source_count})"
                )
                return best_match_id, "active"
        else:
            # No match → create new cluster
            fp = ClusterFingerprint(
                primary_entities=fingerprint_data.get("primary_entities", []),
                event_action=fingerprint_data.get("event_action", ""),
                event_date=fingerprint_data.get("event_date", ""),
                event_title=fingerprint_data.get("event_title", ""),
            )
            cluster = ClusterState(
                fingerprint=fp,
                status="active",
                source_count=1,
                article_ids=[article_id],
                outlets=[outlet],
                sentence_ids=list(sentence_ids),
                last_updated=datetime.now(timezone.utc).isoformat(),
            )
            cluster.synthesis_ready = cluster.source_count >= MIN_SOURCES_FOR_SYNTHESIS
            self._clusters[cluster.cluster_id] = cluster
            self._save(cluster)
            logger.info(
                f"NEW cluster created: {cluster.cluster_id} "
                f"(entities={fp.primary_entities[:3]}, action={fp.event_action})"
            )
            return cluster.cluster_id, "new"

    def get_cluster(self, cluster_id: str) -> ClusterState | None:
        """Get a cluster by ID."""
        return self._clusters.get(cluster_id)

    def get_all_clusters(self) -> list[ClusterState]:
        """Return all clusters, sorted by last_updated descending."""
        return sorted(
            self._clusters.values(),
            key=lambda c: c.last_updated or c.created_at,
            reverse=True,
        )

    def get_active_clusters(self) -> list[ClusterState]:
        """Return all active clusters."""
        return [c for c in self._clusters.values() if not self._is_closed(c)]

    def close_cluster(self, cluster_id: str) -> None:
        """Manually close a cluster."""
        if cluster_id in self._clusters:
            self._clusters[cluster_id].status = "closed"
            self._save(self._clusters[cluster_id])

    # ─── Matching logic ──────────────────────────────────────────────────────

    def _find_best_match(
        self, fingerprint_data: dict
    ) -> tuple[str | None, float]:
        """
        Find the best matching cluster for the given fingerprint.
        Uses entity overlap + event action matching.
        """
        if not self._clusters:
            return None, 0.0

        incoming_fp_text = self._build_fingerprint_text(fingerprint_data)
        incoming_emb = None
        if self.embedder is not None and incoming_fp_text:
            incoming_emb = self.embedder.embed(incoming_fp_text)

        incoming_entities = set(
            e.lower() for e in fingerprint_data.get("primary_entities", [])
        )
        incoming_action = fingerprint_data.get("event_action", "").lower()

        best_id = None
        best_score = 0.0

        for cid, cluster in self._clusters.items():
            fp = cluster.fingerprint
            cluster_entities = set(e.lower() for e in fp.primary_entities)
            cluster_fp_text = self._build_fingerprint_text(fp)

            if not incoming_entities and not cluster_entities and not incoming_fp_text and not cluster_fp_text:
                continue

            # Entity overlap (Overlap Coefficient / Szymkiewicz-Simpson)
            if incoming_entities or cluster_entities:
                intersection = incoming_entities & cluster_entities
                min_len = min(len(incoming_entities), len(cluster_entities))
                entity_score = len(intersection) / min_len if min_len > 0 else 0.0
            else:
                entity_score = 0.0

            # Action verb bonus
            action_bonus = 0.15 if (
                incoming_action and fp.event_action and
                incoming_action == fp.event_action.lower()
            ) else 0.0

            # Date bonus
            date_bonus = 0.1 if (
                fingerprint_data.get("event_date") and fp.event_date and
                fingerprint_data["event_date"] == fp.event_date
            ) else 0.0

            semantic_score = 0.0
            if incoming_emb is not None:
                if cluster_fp_text:
                    cluster_emb = self.embedder.embed(cluster_fp_text)
                    semantic_score = max(0.0, self._cosine_similarity(incoming_emb, cluster_emb))

            score = max(entity_score + action_bonus + date_bonus, semantic_score)

            if score > best_score:
                best_score = score
                best_id = cid

        return best_id, best_score

    def _merge_fingerprint(
        self, fp: ClusterFingerprint, new_data: dict
    ) -> None:
        """Merge new fingerprint data into existing cluster fingerprint."""
        for entity in new_data.get("primary_entities", []):
            if entity not in fp.primary_entities:
                fp.primary_entities.append(entity)

        # Update action if not set
        if not fp.event_action and new_data.get("event_action"):
            fp.event_action = new_data["event_action"]

        # Update date if not set
        if not fp.event_date and new_data.get("event_date"):
            fp.event_date = new_data["event_date"]

        # Update title if not set
        if not fp.event_title and new_data.get("event_title"):
            fp.event_title = new_data["event_title"]

    @staticmethod
    def _build_fingerprint_text(fp: ClusterFingerprint | dict) -> str:
        """Create a stable text for semantic fingerprint matching."""
        if isinstance(fp, ClusterFingerprint):
            title = fp.event_title
            action = fp.event_action
            date = fp.event_date
            entities = fp.primary_entities
        else:
            title = fp.get("event_title", "")
            action = fp.get("event_action", "")
            date = fp.get("event_date", "")
            entities = fp.get("primary_entities", [])

        parts = []
        if title:
            parts.append(title)
        if action:
            parts.append(action)
        if date:
            parts.append(date)
        if entities:
            parts.extend(entities[:12])

        return " | ".join(p.strip() for p in parts if p and p.strip())

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _is_closed(self, cluster: ClusterState) -> bool:
        """Check if a cluster is closed (explicitly or by time threshold)."""
        if cluster.status == "closed":
            return True

        if not cluster.created_at:
            return False

        try:
            created = datetime.fromisoformat(cluster.created_at)
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age = datetime.now(timezone.utc) - created
            return age > timedelta(hours=cluster.close_threshold_h)
        except (ValueError, TypeError):
            return False

    # ─── Persistence ─────────────────────────────────────────────────────────

    def _save(self, cluster: ClusterState) -> None:
        """Save cluster state to JSON file."""
        path = os.path.join(self.storage_dir, f"{cluster.cluster_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cluster.to_dict(), f, indent=2, ensure_ascii=False)

    def _load_all(self) -> None:
        """Load all cluster JSON files from storage directory."""
        for fname in os.listdir(self.storage_dir):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.storage_dir, fname)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                cluster = ClusterState.from_dict(data)
                self._clusters[cluster.cluster_id] = cluster
            except Exception as exc:
                logger.warning(f"Failed to load cluster from {fname}: {exc}")
