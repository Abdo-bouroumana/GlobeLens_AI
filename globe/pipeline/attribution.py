"""
Attribution Locking Module
============================
Implements §9 of the pipeline spec.

After synthesis, each output sentence is embedded and matched against
the cluster's translated sentence pool in Qdrant. Since each original
sentence mapping holds provenance (outlet, url, original_text, offsets),
attribution is built directly from the matching payload.
"""

import logging
from typing import Any

from pipeline.data_models import HoverPayload, SourceReference, SentenceMapping, FactObject
from pipeline.vector_store import VectorStore

logger = logging.getLogger(__name__)


class AttributionLocker:
    """
    Links synthesized sentences back to their original native-language
    sources via vector search over the sentence pool.
    """

    def __init__(self, embedder: Any, vector_store: VectorStore, threshold: float = 0.82):
        self.embedder = embedder
        self.vector_store = vector_store
        self.threshold = threshold

    def lock_attribution(
        self,
        cluster_id: str,
        synthesized_sections: dict[str, list[dict]],
        facts: list[FactObject],
    ) -> list[HoverPayload]:
        """
        Build attribution payloads for all sentences in the synthesis.

        Args:
            cluster_id:           ID to filter sentence search.
            synthesized_sections: Output from Summarizer.synthesize().
            facts:                List of FactObjects used in synthesis.

        Returns:
            List of HoverPayload objects containing full attribution metadata.
        """
        payloads = []

        for section, sentences in synthesized_sections.items():
            for i, sent_dict in enumerate(sentences):
                # We need a unique ID for the frontend to bind the hover
                sent_id = f"synthesized_{cluster_id}_{section[:3]}_{i}"
                text = sent_dict.get("text", "")
                fact_indices = sent_dict.get("fact_indices", [])
                conf_count = sent_dict.get("confirmation_count", 0)

                if not text:
                    continue

                # 1. Gather all candidate sentence_ids from the cited facts
                candidate_sentence_ids = set()
                contradiction_notes = []
                for idx in fact_indices:
                    if 0 <= idx < len(facts):
                        fact = facts[idx]
                        candidate_sentence_ids.update(fact.source_sentence_ids)
                        if fact.contradicted_by:
                            for c in fact.contradicted_by:
                                if isinstance(c, dict):
                                    if c.get("type") == "contradiction":
                                        # New structured A-vs-B format from Compressor.detect_contradictions()
                                        claim_a = c.get("claim_a", {})
                                        claim_b = c.get("claim_b", {})
                                        nature  = c.get("nature", "conflict")
                                        contradiction_notes.append(
                                            f"Contradiction ({nature}) — "
                                            f"[{claim_a.get('source', '?')}]: \"{claim_a.get('text', '')}\" "
                                            f"vs [{claim_b.get('source', '?')}]: \"{claim_b.get('text', '')}\""
                                        )
                                    else:
                                        # Legacy format: {"outlet": ..., "text": ...}
                                        contradiction_notes.append(
                                            f"Contradiction ({c.get('outlet', '?')}): {c.get('text', '')}"
                                        )

                # 2. Vector search against the cluster's sentence pool
                # We constrain the search to just this cluster to ensure we only
                # cite sources relevant to this event.
                query_emb = self.embedder.embed(text)
                
                # Search the sentence-level collection
                matches = self.vector_store.search_sentences(
                    query_embedding=query_emb,
                    cluster_id=cluster_id,
                    top_k=5  # Up to 5 source quotes per sentence
                )

                # Filter matches by threshold
                valid_matches = [m for m in matches if m["score"] >= self.threshold]
                
                # If we have no matches above threshold but we know which sentences
                # contributed (from fact_indices), we can fetch them directly.
                # In a full implementation, we'd batch-fetch by ID from Qdrant.
                # Here we'll just use the vector search results.

                source_refs = []
                seen_outlets = set()
                
                for m in valid_matches:
                    outlet = m.get("outlet", "Unknown")
                    # Deduplicate: one quote per outlet per synthesis sentence
                    if outlet in seen_outlets:
                        continue
                        
                    seen_outlets.add(outlet)
                    ref = SourceReference(
                        outlet=outlet,
                        article_title=m.get("article_title", ""),
                        url=m.get("url", ""),
                        published_at=m.get("published_at", ""),
                        original_text=m.get("original_text", ""),
                        translated_text=m.get("translated_text", ""),
                        char_start=m.get("char_start", 0),
                        char_end=m.get("char_end", 0),
                        verified=True,
                        credibility=m.get("credibility", "outlet-level")
                    )
                    source_refs.append(ref)

                payload = HoverPayload(
                    summary_sentence_id=sent_id,
                    summary_text=text,
                    sources=source_refs,
                    confirmation_count=conf_count,
                    contradiction_note=" | ".join(contradiction_notes),
                    section=section
                )
                payloads.append(payload)
                
                # Update the original dict with the generated ID so the frontend
                # can link them
                sent_dict["sentence_id"] = sent_id

        logger.info(f"Built {len(payloads)} attribution hover payloads for cluster {cluster_id}")
        return payloads
