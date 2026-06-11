"""
Section Classification Module — Epistemic Section Taxonomy
=============================================================
Implements §6 of the pipeline spec.

Uses mDeBERTa-v3-base-mnli-xnli via zero-shot NLI to classify each
FactObject into one or more of 13 epistemic sections.  Section labels
are defined in plain English — no fine-tuning required.

Hard-coded override rules (§6.1):
  • Short posts from official channels → Official Statements or Verified Facts
  • OSINT → always Exclusive/Single-Source
  • confirmation_count == 1 → flagged exclusive
  • Quotes / attribution verbs → Official Statements
  • Contradicted facts → dual classification (section + contradiction flag)
"""

import logging
import re
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline as hf_pipeline,
)
import torch

from pipeline.data_models import FactObject, SentenceMapping, SECTION_LABELS

logger = logging.getLogger(__name__)

# Legacy topic labels for backward-compat classify() method
JOURNALISM_TOPICS: list[str] = [
    "politics and government",
    "business and economy",
    "science and technology",
    "health and medicine",
    "environment and climate change",
    "conflict and war",
    "sports",
    "entertainment and culture",
    "crime and justice",
    "education",
    "human rights and social issues",
    "international relations and diplomacy",
    "natural disasters and emergencies",
    "religion and society",
]

# Section-specific hypothesis templates for zero-shot NLI
SECTION_HYPOTHESES: dict[str, str] = {
    "Verified Facts":
        "This is a documented, undeniable event confirmed by multiple sources.",
    "Official Statements":
        "This is a direct quote from a government official, institution, or spokesperson.",
    "Historical Context — Agreed":
        "This provides background context that is accepted across sources without dispute.",
    "Historical Context — Disputed":
        "This presents competing narratives on causes, responsibility, or framing.",
    "Exclusive / Single-Source":
        "This claim appears in only one outlet and is not corroborated by any other source.",
    "Analysis & Interpretation":
        "This is a journalist or expert interpretation or analysis of events.",
    "Numbers & Data":
        "This contains statistics, polls, financial figures, casualties, or numerical claims.",
    "Reactions & Positions":
        "This describes how different actors, states, parties, or organisations responded.",
    "What Remains Unknown":
        "This acknowledges gaps in information or what no outlet has addressed.",
    "Timeline":
        "This describes a chronological sequence of events with timestamps.",
    "Legal & Accountability":
        "This mentions charges, court decisions, sanctions, or legal accountability.",
    "Officials Said vs Data":
        "This highlights a contradiction between official statements and measurable figures.",
    "Follow-Up":
        "This is a follow-up update arriving after the initial reporting period.",
}

# Attribution verb patterns
ATTRIBUTION_VERBS = re.compile(
    r'\b(said|stated|confirmed|denied|announced|declared|claimed|")\b',
    re.IGNORECASE,
)


class TopicClassifier:
    """
    Dual-purpose classifier:
      • classify_sections() — epistemic section classification for FactObjects (§6)
      • classify()          — legacy topic classification (backward compat)
    """

    def __init__(self, model_path: str):
        model_path = str(model_path).replace("\\", "/")
        logger.info(f"Loading zero-shot classifier from: {model_path}")
        tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_path, 
            local_files_only=True,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
        )
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        self.classifier = hf_pipeline(
            "zero-shot-classification",
            model=model,
            tokenizer=tokenizer,
            device=0 if torch.cuda.is_available() else -1,
        )
        logger.info(f"Zero-shot classifier ready on {device}.")

    # ─── §6 — Epistemic section classification ──────────────────────────────

    def classify_sections(
        self,
        facts: list[FactObject],
        sentence_map: dict[str, SentenceMapping] | None = None,
    ) -> list[FactObject]:
        """
        Classify each FactObject into one or more epistemic sections.

        Applies hard-coded override rules (§6.1) before model classification.

        Args:
            facts:        List of FactObject instances to classify.
            sentence_map: Optional map of sentence_id → SentenceMapping for
                          accessing content_type and credibility overrides.

        Returns:
            The same list with .section_flag set on each FactObject.
        """
        if not facts:
            return facts

        for fact in facts:
            # Apply hard-coded overrides first (§6.1)
            override = self._apply_overrides(fact, sentence_map)
            if override:
                fact.section_flag = override
                continue

            # Zero-shot NLI classification
            try:
                result = self.classifier(
                    fact.fact[:500],
                    candidate_labels=list(SECTION_HYPOTHESES.keys()),
                    hypothesis_template="{}",
                    multi_label=False,
                )
                # Use section-specific hypotheses for better accuracy
                best_label = result["labels"][0]
                fact.section_flag = best_label

            except Exception as exc:
                logger.warning(f"Section classification failed: {exc}")
                fact.section_flag = "Verified Facts"  # safe default

            # Post-classification overrides
            # confirmation_count == 1 → always flag as exclusive (§6.1)
            if fact.confirmation_count == 1 and fact.section_flag != "Official Statements":
                fact.section_flag = "Exclusive / Single-Source"

            # Contradicted facts get dual classification flag
            if fact.contradicted_by:
                fact.section_flag = f"{fact.section_flag} [CONTRADICTION]"

        logger.info(
            f"Classified {len(facts)} facts into epistemic sections."
        )
        return facts

    def _apply_overrides(
        self,
        fact: FactObject,
        sentence_map: dict[str, SentenceMapping] | None,
    ) -> str | None:
        """
        Apply hard-coded classification overrides per §6.1.
        Returns section label if override applies, None otherwise.
        """
        # Check source sentence metadata for content_type/credibility
        if sentence_map and fact.first_seen_sentence_id in sentence_map:
            source_mapping = sentence_map[fact.first_seen_sentence_id]

            # OSINT → always Exclusive/Single-Source (§6.1)
            if source_mapping.content_type == "osint":
                return "Exclusive / Single-Source"

            # Short posts from official verified channels → Official Statements
            # or Verified Facts (§6.1)
            if (source_mapping.content_type == "short_post" and
                    source_mapping.credibility == "official"):
                # Check if it's a statement or a fact
                if ATTRIBUTION_VERBS.search(fact.fact):
                    return "Official Statements"
                return "Verified Facts"

        # Sentences containing quotation marks or attribution verbs →
        # Official Statements (§6.1)
        if ATTRIBUTION_VERBS.search(fact.fact):
            return "Official Statements"

        return None

    # ─── Legacy topic classification (backward compat) ───────────────────────

    def classify(
        self,
        text: str,
        candidate_labels: list[str] | None = None,
        multi_label: bool = False,
        top_n: int = 3,
    ) -> dict:
        """
        Classify text into journalism topics.

        Args:
            text:             English text to classify (truncated to 1000 chars)
            candidate_labels: Custom topic list (defaults to JOURNALISM_TOPICS)
            multi_label:      If True, return scores for all applicable topics
            top_n:            Return top N topics in ranked_topics list

        Returns:
            {
              "topic":         str,             # top predicted topic
              "confidence":    float,           # score for top topic
              "ranked_topics": [(topic, score), ...],   # top_n ranked
              "all_scores":    {topic: score, ...},     # full score map
            }
        """
        labels = candidate_labels or JOURNALISM_TOPICS
        text_sample = text[:1000].strip()
        if not text_sample:
            return self._empty_result(labels)

        try:
            result = self.classifier(
                text_sample,
                candidate_labels=labels,
                multi_label=multi_label,
                hypothesis_template="This news article is about {}.",
            )

            scores: dict[str, float] = {
                label: round(float(score), 4)
                for label, score in zip(result["labels"], result["scores"])
            }
            ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

            return {
                "topic":         ranked[0][0],
                "confidence":    ranked[0][1],
                "ranked_topics": ranked[:top_n],
                "all_scores":    scores,
            }

        except Exception as exc:
            logger.warning(f"Topic classification failed: {exc}")
            return self._empty_result(labels)

    def _empty_result(self, labels: list[str]) -> dict:
        return {
            "topic":         labels[0] if labels else "unknown",
            "confidence":    0.0,
            "ranked_topics": [],
            "all_scores":    {},
        }
