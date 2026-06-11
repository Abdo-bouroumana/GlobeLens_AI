"""
Bias Detection Module — Per-Sentence + Cluster Aggregation
============================================================
Implements §7 of the pipeline spec.

Uses valurank/distilroberta-bias for per-sentence bias scoring.
Aggregates results per outlet and per cluster to produce a
bias_frequency_map that surfaces in the Analysis section.

Bias outputs per sentence (§7):
  • bias_score:         0.0 – 1.0
  • bias_direction:     left | right | neutral | institutional | nationalistic
  • loaded_terms:       specific words/phrases with implicit framing
  • framing_technique:  word_choice | omission | emphasis | false_balance | none

Cluster-level:
  • bias_frequency_map: percentage of sentences per direction across all outlets
"""

import logging
import re
from collections import Counter, defaultdict
from typing import Any

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline as hf_pipeline,
)

from pipeline.data_models import SentenceMapping

logger = logging.getLogger(__name__)

# Loaded/biased term patterns (common framing indicators)
LOADED_TERM_PATTERNS = [
    # Emotional amplifiers
    r'\b(devastating|catastrophic|horrific|brutal|savage|unprecedented)\b',
    # Delegitimizing language
    r'\b(regime|puppet|radical|extremist|terrorist|militant)\b',
    # Euphemisms
    r'\b(collateral damage|neutralize|enhanced interrogation|special operation)\b',
    # Absolutist language
    r'\b(always|never|all|every|no one|everyone|completely|totally)\b',
]

# Simple framing technique indicators
FRAMING_INDICATORS = {
    "word_choice": re.compile(
        r'\b(regime|terrorist|freedom fighter|militant|rebel|liberator)\b', re.I
    ),
    "emphasis": re.compile(
        r'\b(notably|importantly|crucially|significantly|remarkably)\b', re.I
    ),
    "false_balance": re.compile(
        r'\b(some say|others argue|on the other hand|both sides)\b', re.I
    ),
}


class BiasDetector:
    """
    Media bias detector with per-sentence scoring and cluster-level aggregation.
    """

    def __init__(self, model_path: str):
        model_path = str(model_path).replace("\\", "/")
        logger.info(f"Loading bias detector from: {model_path}")
        import torch
        tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_path, 
            local_files_only=True,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
        )
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        device_id = 0 if torch.cuda.is_available() else -1
        self.classifier = hf_pipeline(
            "text-classification",
            model=model,
            tokenizer=tokenizer,
            top_k=None,      # return scores for all labels
            device=device_id,
        )
        logger.info(f"Bias detector ready on {device}.")

    # ─── §7 — Per-sentence bias detection ────────────────────────────────────

    # Calibrated threshold: only surface sentences with BIASED confidence
    # above this value.  At 0.65 the signal is useful without flagging
    # virtually every sentence (the "100% bias" false-positive problem).
    BIAS_THRESHOLD: float = 0.65

    def detect_sentences(
        self,
        sentence_mappings: list[SentenceMapping],
    ) -> list[SentenceMapping]:
        """
        Run bias detection on each SentenceMapping's translated text in batches.

        FIX — calibrated threshold:
          Instead of binary biased/neutral, we now store the raw confidence
          score and only set bias_label="BIASED" when the score exceeds
          BIAS_THRESHOLD (0.65).  This eliminates the 100%-biased false
          positive rate caused by treating every non-neutral prediction as
          biased regardless of confidence.

        FIX — differentiated bias types:
          We infer a bias_type for each flagged sentence:
            • loaded_language  — emotionally charged vocabulary
            • framing          — emphasis / false-balance language
            • institutional    — state/authority-centred framing
            • nationalistic    — sovereignty/homeland framing
          This makes false positives immediately obvious and gives
          readers actionable context.
        """
        biased_count = 0
        texts = [m.translated_text or m.original_text for m in sentence_mappings]

        try:
            batch_results = self.classifier(texts, batch_size=32)
        except Exception as exc:
            logger.warning(f"Batched Bias detection failed: {exc}. Falling back to neutral.")
            batch_results = [[{"label": "neutral", "score": 1.0}]] * len(texts)

        for mapping, raw_scores in zip(sentence_mappings, batch_results):
            # raw_scores: [{label, score}, ...]
            best_match = max(raw_scores, key=lambda x: x["score"])

            raw_score = float(best_match["score"])
            raw_label = best_match["label"].upper()

            # Store raw confidence always — useful for downstream calibration
            mapping.bias_score = round(raw_score, 4)

            # Only mark BIASED when confidence clears the calibrated threshold
            if raw_label == "BIASED" and raw_score >= self.BIAS_THRESHOLD:
                mapping.bias_label = "BIASED"
                biased_count += 1
                # Attach differentiated bias type (stored in bias_type if attr exists)
                text = mapping.translated_text or mapping.original_text
                mapping.bias_type = self._classify_bias_type(text)
            else:
                mapping.bias_label = "NEUTRAL"
                mapping.bias_type  = "none"

        logger.info(
            f"Batched bias detection (threshold={self.BIAS_THRESHOLD}): "
            f"{biased_count}/{len(sentence_mappings)} sentences flagged as BIASED "
            f"({100*biased_count/max(len(sentence_mappings),1):.1f}%)."
        )
        return sentence_mappings

    def _classify_bias_type(self, text: str) -> str:
        """
        Classify which *type* of bias is present in a flagged sentence.

        Types (in priority order):
          loaded_language — emotional amplifiers or delegitimizing terms
          framing         — word_choice / emphasis / false_balance markers
          institutional   — government/authority-centric framing
          nationalistic   — sovereignty/homeland framing
          general         — catch-all when no specific pattern matches
        """
        text_lower = text.lower()

        # Loaded language takes highest priority
        for pattern in LOADED_TERM_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return "loaded_language"

        # Framing techniques
        for technique, pattern in FRAMING_INDICATORS.items():
            if pattern.search(text):
                return technique

        # Institutional bias
        institutional_markers = {"government", "ministry", "official", "authority", "state"}
        if sum(1 for m in institutional_markers if m in text_lower) >= 2:
            return "institutional"

        # Nationalistic bias
        nationalist_markers = {"national", "homeland", "patriot", "sovereignty", "nation"}
        if sum(1 for m in nationalist_markers if m in text_lower) >= 2:
            return "nationalistic"

        return "general"

    # ─── §7 — Cluster-level aggregation ──────────────────────────────────────

    def aggregate_cluster(
        self,
        sentence_mappings: list[SentenceMapping],
    ) -> dict[str, Any]:
        """
        Aggregate bias results across all sentences in a cluster.

        Returns:
            {
                "bias_frequency_map": {direction: percentage, ...},
                "per_outlet": {outlet: {direction: count, avg_score: float}, ...},
                "loaded_terms": [str, ...],
                "total_biased_ratio": float,
            }
        """
        outlet_scores: dict[str, list[float]] = defaultdict(list)
        direction_counts: Counter = Counter()
        all_loaded_terms: list[str] = []
        total_biased = 0
        total = len(sentence_mappings)

        for mapping in sentence_mappings:
            text = mapping.translated_text or mapping.original_text
            outlet = mapping.outlet

            # Collect bias scores per outlet
            outlet_scores[outlet].append(mapping.bias_score)

            # Determine bias direction (heuristic since distilroberta-bias
            # only gives BIASED/NEUTRAL — direction is inferred from content)
            direction = self._infer_direction(text)
            direction_counts[direction] += 1

            if mapping.bias_label == "BIASED":
                total_biased += 1

            # Extract loaded terms
            loaded = self._extract_loaded_terms(text)
            all_loaded_terms.extend(loaded)

        # Build frequency map (direction → percentage)
        bias_frequency_map = {}
        if total > 0:
            for direction, count in direction_counts.items():
                bias_frequency_map[direction] = round(count / total * 100, 1)

        # Per-outlet stats
        per_outlet = {}
        for outlet, scores in outlet_scores.items():
            avg_score = sum(scores) / len(scores) if scores else 0.0
            per_outlet[outlet] = {
                "avg_bias_score": round(avg_score, 4),
                "sentence_count": len(scores),
                "biased_count": sum(1 for s in scores if s > 0.5),
            }

        return {
            "bias_frequency_map": bias_frequency_map,
            "per_outlet": per_outlet,
            "loaded_terms": list(set(all_loaded_terms)),
            "total_biased_ratio": round(total_biased / total, 4) if total > 0 else 0.0,
        }

    def _infer_direction(self, text: str) -> str:
        """
        Infer bias direction from text content.
        This is a heuristic — distilroberta-bias only gives BIASED/NEUTRAL,
        not direction. We use keyword-based inference as a proxy.
        """
        text_lower = text.lower()

        institutional_markers = {"government", "ministry", "official", "authority", "state"}
        nationalist_markers = {"national", "homeland", "patriot", "sovereignty", "nation"}

        inst_count = sum(1 for m in institutional_markers if m in text_lower)
        nat_count = sum(1 for m in nationalist_markers if m in text_lower)

        if inst_count >= 2:
            return "institutional"
        if nat_count >= 2:
            return "nationalistic"

        return "neutral"

    def _extract_loaded_terms(self, text: str) -> list[str]:
        """Extract specific words or phrases flagged as carrying implicit framing."""
        terms = []
        for pattern in LOADED_TERM_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            terms.extend(matches)
        return terms

    def _detect_framing(self, text: str) -> str:
        """Detect framing technique used in the sentence."""
        for technique, pattern in FRAMING_INDICATORS.items():
            if pattern.search(text):
                return technique
        return "none"

    # ─── Legacy single-text detection (backward compat) ──────────────────────

    def detect(self, text: str, max_chars: int = 512) -> dict:
        """
        Detect bias in English article text.

        Args:
            text:      Input English text
            max_chars: Max characters fed to the model (model has 512-token limit)

        Returns:
            {
              "label":      "BIASED" | "NEUTRAL",
              "score":      float,          # confidence of winning label [0–1]
              "biased":     float,          # raw BIASED score
              "neutral":    float,          # raw NEUTRAL score
              "is_biased":  bool,
            }
        """
        text_sample = text[:max_chars].strip()
        if not text_sample:
            return self._neutral_result()

        try:
            raw = self.classifier(text_sample)
            # raw is [[{"label": ..., "score": ...}, ...]] with top_k=None
            label_scores = raw[0] if isinstance(raw[0], list) else raw
            scores: dict[str, float] = {
                item["label"]: round(float(item["score"]), 4)
                for item in label_scores
            }

            # Determine winner
            top = max(label_scores, key=lambda x: x["score"])
            label = top["label"]       # "BIASED" or "NEUTRAL"
            score = round(float(top["score"]), 4)

            return {
                "label":     label,
                "score":     score,
                "biased":    scores.get("BIASED", 0.0),
                "neutral":   scores.get("NEUTRAL", 0.0),
                "is_biased": label == "BIASED",
            }

        except Exception as exc:
            logger.warning(f"Bias detection failed: {exc}")
            return self._neutral_result()

    def _neutral_result(self) -> dict:
        return {
            "label":     "NEUTRAL",
            "score":     1.0,
            "biased":    0.0,
            "neutral":   1.0,
            "is_biased": False,
        }