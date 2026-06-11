import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

from pipeline.data_models import SentenceMapping, FactObject, ClusterState

logger = logging.getLogger(__name__)

# Default model sub-directory names (relative to HF_MODEL_DIR)
_LANG_DETECT_DIR  = "saved_langdetect_model"
_NLLB_DIR         = "nllb_model_local"
_NER_DIR          = "saved_xlm_roberta_ner"
_CLASSIFIER_DIR   = "mdeberta_zero_shot"
_BIAS_DIR         = "bias_model_local"
_EMBED_DIR        = "bge_m3_local"


class JournalismPipeline:
    """
    GlobeLens AI — end-to-end journalism pipeline.

    Constructor accepts flat keyword arguments so it can be instantiated
    directly from run_pipeline.py and api.py without a separate factory.

    Args:
        ollama_model:         Ollama model tag for summarization.
        ollama_url:           Ollama server base URL.
        use_local_qdrant:     Use embedded Qdrant instead of a remote server.
        qdrant_storage_path:  Path for the embedded Qdrant database.
        cluster_storage_path: Directory for JSON cluster state files.
        hf_model_dir:         Root directory containing all HuggingFace models.
                              Defaults to the HF_MODEL_DIR env var, then
                              <project_root>/hugging-face.
    """

    def __init__(
        self,
        ollama_model: str = "aya-expanse:8b",
        ollama_url: str = "http://localhost:11434",
        use_local_qdrant: bool = True,
        qdrant_storage_path: str | None = None,
        cluster_storage_path: str | None = None,
        hf_model_dir: str | None = None,
    ):
        self.logger = logging.getLogger("GlobeLens")

        # ── Resolve model root ────────────────────────────────────────────────
        if hf_model_dir is None:
            hf_model_dir = (
                os.environ.get("HF_MODEL_DIR")
                or os.environ.get("HUGGING_FACE_DIR")
                or os.environ.get("HF_DIR")
                # Models live next to the project folder, not inside it:
                # Desktop/hugging-face  (not Desktop/globe/hugging-face)
                or os.path.join(os.path.dirname(__file__), "..", "..", "hugging-face")
            )
        hf_model_dir = str(os.path.abspath(hf_model_dir)).replace("\\", "/")
        self.logger.info(f"HuggingFace model root: {hf_model_dir}")

        from pathlib import Path

        def _model(subdir: str) -> str:
            return f"{hf_model_dir}/{subdir}"

        # ── Storage paths ─────────────────────────────────────────────────────
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        if cluster_storage_path is None:
            cluster_storage_path = os.path.join(project_root, "clusters", "default")
        os.makedirs(cluster_storage_path, exist_ok=True)

        if qdrant_storage_path is None and use_local_qdrant:
            qdrant_storage_path = os.path.join(
                os.environ.get("HF_MODEL_DIR")
                or os.path.join(project_root, "hugging-face"),
                "qdrant_storage",
            )

        # ── Instantiate all sub-modules ───────────────────────────────────────
        from pipeline.language_detector import LanguageDetector
        from pipeline.translator      import Translator
        from pipeline.sentence_splitter import SentenceSplitter
        from pipeline.embedder        import Embedder
        from pipeline.vector_store    import VectorStore
        from pipeline.ner_extractor   import NERExtractor
        from pipeline.topic_classifier import TopicClassifier
        from pipeline.bias_detector   import BiasDetector
        from pipeline.compressor      import Compressor
        from pipeline.cluster_manager import ClusterManager
        from pipeline.summarizer      import Summarizer
        from pipeline.attribution     import AttributionLocker

        self.language_detector = LanguageDetector(_model(_LANG_DETECT_DIR))
        self.translator        = Translator(_model(_NLLB_DIR))
        self.sentence_splitter = SentenceSplitter()
        self.embedder          = Embedder(_model(_EMBED_DIR))
        self.vector_store      = VectorStore(
            storage_path=qdrant_storage_path if use_local_qdrant else None
        )
        self.ner_extractor     = NERExtractor(_model(_NER_DIR))
        self.classifier        = TopicClassifier(_model(_CLASSIFIER_DIR))
        self.bias_detector     = BiasDetector(_model(_BIAS_DIR))
        self.compressor        = Compressor(embedder=self.embedder)
        self.cluster_manager   = ClusterManager(
            storage_dir=cluster_storage_path,
            embedder=self.embedder,
        )
        self.synthesizer       = Summarizer(
            ollama_url=ollama_url,
            model=ollama_model,
        )
        self.attribution       = AttributionLocker(
            embedder=self.embedder,
            vector_store=self.vector_store,
        )

        # Lock to serialise cluster routing — ClusterManager._clusters is not
        # thread-safe; concurrent route() calls cause "dict changed size during
        # iteration" when one thread adds a cluster while another iterates it.
        self._cluster_lock = __import__("threading").Lock()

        self.logger.info("=================================================================")
        self.logger.info("  GlobeLens AI — Pipeline Fully Initialized (Cluster Mode)")
        self.logger.info("=================================================================")

    # ── Public convenience aliases ────────────────────────────────────────────

    def ingest(self, text: str, title: str = "", url: str = "",
               source: str = "", published_at: str = "",
               content_type: str = "article",
               credibility: str = "outlet-level") -> Tuple[str, str]:
        """Single-article ingest (delegates to ingest_batch). Returns (cluster_id, action)."""
        results = self.ingest_batch([{
            "text": text, "title": title, "url": url, "source": source,
            "published_at": published_at,
            "content_type": content_type, "credibility": credibility,
        }])
        return results[0]

    # Keep the old name as well for any callers that used it directly.
    ingest_article = ingest

    # ── Core batch ingest ─────────────────────────────────────────────────────

    def ingest_batch(self, articles: List[Dict[str, Any]]) -> List[Tuple[str, str]]:
        """
        Ingest multiple articles in a single GPU batch.

        GPU utilisation strategy
        ────────────────────────
        The translation model (NLLB) and the embedding model are the two
        heavy GPU consumers.  Calling them once-per-sentence (as the old
        loop did) means tiny batches hit the GPU kernel-launch overhead
        far more often than necessary, leaving the device underutilised
        between calls.

        Here we:
          1. Run all CPU-bound preprocessing in parallel threads (sentence
             splitting + language detection per article).
          2. Collect every SentenceMapping from ALL articles into one flat
             list and send it to translator.translate_sentences() in a
             single GPU call — the translator already packs them into
             sub-batches by source language, so no extra batching logic is
             needed here.
          3. Embed the full cross-article translated sentence list in one
             embedder call, keeping the GPU busy continuously.
          4. Fan the results back out to per-article lists and complete
             the CPU-bound cluster routing + storage steps (also in
             parallel threads since they are I/O and CPU, not GPU).

        Args:
            articles: list of dicts with keys:
                        text, source, title, url (opt), published_at (opt),
                        content_type (opt), credibility (opt)

        Returns:
            List of (cluster_id, action) tuples in the same order as input.
        """
        if not articles:
            return []

        # ── Step 1: CPU-parallel sentence splitting + language detection ──────
        # These are CPU / small-model operations. NER is intentionally NOT run
        # here — running the same HuggingFace pipeline from multiple threads
        # simultaneously causes GPU contention and the "using pipelines
        # sequentially" warning. NER runs as one cross-article batch below.

        def _preprocess(idx_article):
            idx, art = idx_article
            content_type = art.get("content_type", "article")
            sent_dicts = self.sentence_splitter.split(art["text"], content_type=content_type)

            mappings: List[SentenceMapping] = []
            for sent_dict in sent_dicts:
                sent_text = sent_dict["text"]
                lang_code, _conf = self.language_detector.detect(sent_text)
                nllb_code = self.language_detector.get_nllb_code(lang_code)
                m = SentenceMapping(
                    original_text = sent_text,
                    original_lang = nllb_code,
                    article_id    = str(uuid.uuid4()),
                    outlet        = art.get("source", ""),
                    url           = art.get("url", ""),
                    article_title = art.get("title", ""),
                    published_at  = art.get("published_at", ""),
                    content_type  = content_type,
                    credibility   = art.get("credibility", "outlet-level"),
                    char_start    = sent_dict.get("char_start", 0),
                    char_end      = sent_dict.get("char_end", len(sent_text)),
                )
                mappings.append(m)
            return idx, mappings

        per_article_mappings: List[List[SentenceMapping]] = [None] * len(articles)

        max_cpu_workers = min(len(articles), 8)
        with ThreadPoolExecutor(max_workers=max_cpu_workers) as pool:
            futures = [pool.submit(_preprocess, (i, art))
                       for i, art in enumerate(articles)]
            for fut in as_completed(futures):
                idx, mappings = fut.result()
                per_article_mappings[idx] = mappings

        total_sents = sum(len(m) for m in per_article_mappings)
        self.logger.info(
            f"[BATCH] Preprocessed {len(articles)} articles — "
            f"{total_sents} sentences total."
        )

        # ── Step 1b: Single cross-article NER batch (one GPU call) ───────────
        # Flatten all mappings and run NER once with a HuggingFace Dataset so
        # the pipeline fills the GPU continuously instead of processing each
        # article's sentences as a separate sequential call.
        all_mappings_flat: List[SentenceMapping] = [
            m for ms in per_article_mappings for m in ms
        ]
        try:
            from datasets import Dataset as HFDataset
            texts_for_ner = [m.original_text for m in all_mappings_flat]
            hf_ds = HFDataset.from_dict({"text": texts_for_ner})
            batch_results = []
            for out in self.ner_extractor.ner_pipeline(
                hf_ds["text"], batch_size=32
            ):
                batch_results.append(out)
        except Exception:
            # Fallback: plain list call (still batched, just no Dataset wrapper)
            texts_for_ner = [m.original_text for m in all_mappings_flat]
            try:
                batch_results = self.ner_extractor.ner_pipeline(
                    texts_for_ner, batch_size=32
                )
            except Exception as exc:
                self.logger.warning(f"NER batch failed: {exc}. Using empty entities.")
                batch_results = [[] for _ in all_mappings_flat]

        # Attach entity results back onto each mapping
        import re as _re
        total_entities = 0
        for mapping, raw in zip(all_mappings_flat, batch_results):
            all_ents = []
            for ent in (raw or []):
                word = ent.get("word", "").strip()
                if len(word) < 2 or ent.get("score", 0) < 0.5:
                    continue
                word = _re.sub(r"^[▁#]+", "", word).strip()
                if not word:
                    continue
                all_ents.append({
                    "text":  word,
                    "label": ent.get("entity_group", "O"),
                    "score": round(float(ent.get("score", 0)), 4),
                    "start": ent.get("start", 0),
                    "end":   ent.get("end", 0),
                })
            mapping.entities = self.ner_extractor._deduplicate(all_ents)
            total_entities += len(mapping.entities)
        self.logger.info(
            f"[BATCH] NER complete — {total_entities} entities across "
            f"{len(all_mappings_flat)} sentences."
        )

        # ── Step 2: Single GPU translation call across ALL articles ───────────
        self.translator.translate_sentences(all_mappings_flat, skip_english=True)

        non_english = sum(1 for m in all_mappings_flat if m.original_lang != "eng_Latn")
        self.logger.info(
            f"[BATCH] GPU translation complete — "
            f"{non_english}/{len(all_mappings_flat)} sentences translated."
        )

        # ── Step 3: Single GPU embedding call across ALL articles ─────────────
        flat_translated = [m.translated_text for m in all_mappings_flat]
        flat_embeddings = self.embedder.embed_batch(flat_translated)

        # Assign translated_text back so mappings carry both original and
        # translated, then split embeddings into per-article slices.
        offset = 0
        per_article_embeddings: List[List[list]] = []
        for article_ms in per_article_mappings:
            n = len(article_ms)
            embs = flat_embeddings[offset: offset + n]
            per_article_embeddings.append(embs)
            offset += n

        self.logger.info(
            f"[BATCH] GPU embedding complete — {len(flat_translated)} vectors generated."
        )

        # ── Step 4: CPU-parallel bias detection + cluster routing + storage ───

        results: List[Tuple[str, str]] = [None] * len(articles)

        def _post_process(idx):
            art      = articles[idx]
            mappings = per_article_mappings[idx]
            embs     = per_article_embeddings[idx]
            source   = art.get("source", "")
            title    = art.get("title", "")

            # Bias scores written directly onto the SentenceMapping objects
            for mapping in mappings:
                result = self.bias_detector.detect(mapping.translated_text)
                mapping.bias_score = result.get("biased", 0.0)
                mapping.bias_label = result.get("label", "NEUTRAL")
                mapping.bias_type  = "general" if result.get("is_biased") else "none"

            biased = sum(1 for m in mappings if m.bias_score >= 0.65)
            self.logger.info(
                f"[{title[:40]}] Bias: {biased}/{len(mappings)} sentences flagged."
            )

            # Gather entity strings from NER results already on the mappings
            entity_strings = list({
                e.get("text", "")
                for m in mappings
                for e in (m.entities or [])
                if e.get("text")
            })

            fingerprint_data = {
                "primary_entities": entity_strings[:10],
                "event_action":     "",
                "event_date":       art.get("published_at", ""),
                "event_title":      title,
            }

            # The centroid embedding for cluster matching is the mean of all
            # sentence embeddings for this article.
            import numpy as np
            centroid = list(np.mean(embs, axis=0)) if embs else []

            article_id   = mappings[0].article_id if mappings else str(uuid.uuid4())
            sentence_ids = [m.sentence_id for m in mappings]

            # Cluster routing and storage must be serialised — ClusterManager
            # is not thread-safe (dict mutation during iteration).
            with self._cluster_lock:
                cluster_id, action = self.cluster_manager.route(
                    fingerprint_data=fingerprint_data,
                    article_id=article_id,
                    outlet=source,
                    sentence_ids=sentence_ids,
                )
                self.vector_store.upsert_sentences(cluster_id, mappings, embs)

            self.logger.info(
                f"[{title[:40]}] → cluster {cluster_id} ({action})"
            )
            return idx, cluster_id, action

        with ThreadPoolExecutor(max_workers=max_cpu_workers) as pool:
            futures = [pool.submit(_post_process, i) for i in range(len(articles))]
            for fut in as_completed(futures):
                idx, cluster_id, action = fut.result()
                results[idx] = (cluster_id, action)

        return results

    # ── Synthesis ─────────────────────────────────────────────────────────────

    def synthesize(self, cluster_id: str) -> Dict[str, Any]:
        """
        Compress, deduplicate, classify, and synthesize all sentences
        in a cluster into a structured journalistic report.
        """
        self.logger.info(f"\n[SYNTHESIS] Processing Cluster ID: {cluster_id}")

        cluster: ClusterState = self.cluster_manager.get_cluster(cluster_id)
        if cluster is None:
            raise ValueError(f"Cluster {cluster_id} not found.")

        # Retrieve all SentenceMappings stored for this cluster
        stored_mappings = self._get_cluster_mappings(cluster_id)
        if not stored_mappings:
            raise ValueError(f"No sentences found for cluster {cluster_id}")

        # 1. Compress
        compressed = self.compressor.compress(stored_mappings)
        self.logger.info(
            f"Compressed {len(stored_mappings)} → {len(compressed)} sentences."
        )

        # 2. Deduplicate across sources → FactObjects
        facts: List[FactObject] = self.compressor.deduplicate(compressed)

        # 3. Contradiction detection — returns the same facts list with
        #    .contradicted_by populated on affected FactObjects
        facts = self.compressor.detect_contradictions(facts, stored_mappings)
        contradictions = [
            f for f in facts if f.contradicted_by
        ]
        for f in contradictions:
            self.logger.info(
                f"Contradiction flagged on fact from '{f.first_seen_outlet}': "
                f"{len(f.contradicted_by)} conflicting claim(s)."
            )

        # 4. Epistemic section classification
        sentence_map = {m.sentence_id: m for m in stored_mappings}
        facts = self.classifier.classify_sections(facts, sentence_map=sentence_map)
        self.logger.info(f"Classified {len(facts)} facts into epistemic sections.")

        # 5. Bias summary for the synthesis prompt
        bias_summary = self._build_bias_summary(stored_mappings)

        # 6. Determine synthesis mode
        mode = "first"
        if cluster.synthesis_text:
            mode = "follow_up" if cluster.status == "closed" else "re_synthesis"

        # 7. LLM synthesis
        sections = self.synthesizer.synthesize(
            cluster=cluster,
            facts=facts,
            bias_summary=bias_summary,
            mode=mode,
        )

        # 8. Persist synthesis text back onto the cluster
        import json
        cluster.synthesis_text = json.dumps(sections)
        cluster.last_updated = datetime.now(timezone.utc).isoformat()
        self.cluster_manager._save(cluster)

        # 9. Build hover payloads via the attribution engine
        hover_payloads = self.attribution.lock_attribution(
            cluster_id=cluster_id,
            synthesized_sections=sections,
            facts=facts,
        )

        return {
            "cluster_id":   cluster_id,
            "topic":        (cluster.fingerprint.primary_entities[:3]
                             if cluster.fingerprint.primary_entities else []),
            "source_count": cluster.source_count,
            "sections":     sections,
            "hover_payloads": [p.to_dict() if hasattr(p, "to_dict") else p for p in hover_payloads],
            "contradictions": [f.to_dict() for f in contradictions],
            "metrics": {
                "input_sentence_count": len(stored_mappings),
                "final_fact_count":     len(facts),
                "active_contradictions": len(contradictions),
            },
        }

    # Keep old name for compatibility
    synthesize_cluster = synthesize

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_cluster_mappings(self, cluster_id: str) -> List[SentenceMapping]:
        """
        Reconstruct SentenceMapping objects for all sentences in a cluster
        from the vector store payload (Qdrant stores the full mapping dict).
        """
        cluster = self.cluster_manager.get_cluster(cluster_id)
        if cluster is None or not cluster.sentence_ids:
            return []

        # Use a centroid-less scroll: search with a zero vector to get all
        # stored sentences for this cluster (filtered by cluster_id payload).
        # The vector store's search_sentences supports cluster_id filtering.
        # We use a large top_k to retrieve everything.
        dummy = [0.0] * 1024   # bge-m3 dimensionality
        hits = self.vector_store.search_sentences(
            query_embedding=dummy,
            cluster_id=cluster_id,
            top_k=10_000,
        )
        mappings = []
        for h in hits:
            m = SentenceMapping()
            for field in SentenceMapping.__dataclass_fields__:
                if field in h:
                    setattr(m, field, h[field])
            mappings.append(m)
        return mappings

    def _build_bias_summary(self, mappings: List[SentenceMapping]) -> Dict[str, Any]:
        """Aggregate bias scores across all sentences for the synthesis prompt."""
        if not mappings:
            return {}
        from collections import Counter
        labels  = [m.bias_label for m in mappings if m.bias_label]
        counter = Counter(labels)
        total   = len(labels) or 1
        loaded  = [
            m.translated_text[:60]
            for m in mappings
            if m.bias_type in ("loaded_language", "framing")
        ]
        return {
            "bias_frequency_map": {
                k.lower(): round(v / total * 100, 1)
                for k, v in counter.items()
            },
            "loaded_terms": loaded[:10],
        }

    def get_stats(self) -> Dict[str, Any]:
        """Return basic pipeline statistics."""
        clusters = self.cluster_manager.get_all_clusters()
        return {
            "total_clusters":    len(clusters),
            "active_clusters":   sum(1 for c in clusters if c.status == "active"),
            "closed_clusters":   sum(1 for c in clusters if c.status == "closed"),
            "total_sentences":   self.vector_store.count_sentences(),
            "synthesized":       sum(1 for c in clusters if c.synthesis_text),
        }
