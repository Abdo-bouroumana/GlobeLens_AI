"""
GlobeLens AI — Core Data Models
================================
Dataclass definitions for every structured object in the pipeline.

Based on the Cross-Lingual Journalism Intelligence Pipeline specification:
  - SentenceMapping  (§3.2)  — original↔translation pair with attribution metadata
  - FactObject       (§5.2)  — deduplicated cross-source fact with confirmation count
  - ClusterFingerprint (§4.1) — event identity for clustering
  - ClusterState      (§4.2) — full cluster lifecycle state
  - HoverPayload     (§9.2)  — per-sentence attribution data for the hover interface
  - SynthesisOutput  (§12)   — complete cluster output
  - OutletProfile    (§10)   — admin-managed outlet metadata
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
#  Content & Credibility Enums (as plain strings for JSON compat)
# ─────────────────────────────────────────────────────────────────────────────

CONTENT_TYPES   = ("article", "short_post", "statement", "osint")
CREDIBILITY     = ("official", "outlet-level", "unverified")
BIAS_DIRECTIONS = ("left", "right", "neutral", "institutional", "nationalistic")
FRAMING_TYPES   = ("word_choice", "omission", "emphasis", "false_balance", "none")

# 13 epistemic section labels (§6)
SECTION_LABELS: list[str] = [
    "Verified Facts",
    "Official Statements",
    "Historical Context — Agreed",
    "Historical Context — Disputed",
    "Exclusive / Single-Source",
    "Analysis & Interpretation",
    "Numbers & Data",
    "Reactions & Positions",
    "What Remains Unknown",
    "Timeline",
    "Legal & Accountability",
    "Officials Said vs Data",
    "Follow-Up",
]


# ─────────────────────────────────────────────────────────────────────────────
#  §3.2 — Sentence Mapping Object
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SentenceMapping:
    """
    The core attribution unit — pairs every source sentence with its
    translation and full provenance metadata.  Created at the translation
    boundary (§3.2) and carried through the entire pipeline.
    """
    sentence_id:     str   = field(default_factory=lambda: str(uuid.uuid4()))
    original_text:   str   = ""
    original_lang:   str   = ""       # NLLB code: arb_Arab, fra_Latn, eng_Latn …
    translated_text: str   = ""       # English output from NLLB (or original if EN)
    article_id:      str   = ""       # unique article identifier
    outlet:          str   = ""       # publication name
    url:             str   = ""       # canonical source URL
    article_title:   str   = ""
    published_at:    str   = ""
    char_start:      int   = 0        # byte offset in original article
    char_end:        int   = 0
    content_type:    str   = "article"   # article | short_post | statement | osint
    credibility:     str   = "outlet-level"  # official | outlet-level | unverified
    # NER entities extracted from this sentence (native text)
    entities:        list[dict] = field(default_factory=list)
    # Bias score for this sentence (filled later)
    bias_score:      float = 0.0
    bias_label:      str   = "NEUTRAL"
    bias_type:       str   = "none"   # loaded_language | framing | institutional | nationalistic | general | none

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "SentenceMapping":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ─────────────────────────────────────────────────────────────────────────────
#  §5.2 — Fact Object
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FactObject:
    """
    Cross-source deduplicated fact — the fundamental unit fed to the LLM.
    A fact confirmed by 7 outlets is represented by ONE sentence in the
    LLM input, with a confirmation_count of 7.
    """
    fact_id:                  str        = field(default_factory=lambda: str(uuid.uuid4()))
    fact:                     str        = ""    # representative sentence in English
    first_seen_outlet:        str        = ""    # outlet that established the fact
    first_seen_sentence_id:   str        = ""    # SentenceMapping.sentence_id
    confirmed_by:             list[str]  = field(default_factory=list)  # outlet names
    confirmation_count:       int        = 1
    short_post_confirmations: list[str]  = field(default_factory=list)  # Telegram/X
    contradicted_by:          list[dict] = field(default_factory=list)  # [{outlet, text}]
    unique_to:                str | None = None  # outlet name if count == 1
    section_flag:             str        = ""    # pre-classification from mDeBERTa
    # All sentence IDs that contributed to this fact
    source_sentence_ids:      list[str]  = field(default_factory=list)
    # Coverage floor: True when fact was reinstated from a dropped single-source
    # numeric/geopolitical claim — signals the LLM to caveat it appropriately
    flagged_single_source:    bool       = False

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "FactObject":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ─────────────────────────────────────────────────────────────────────────────
#  §4.1 — Cluster Fingerprint
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ClusterFingerprint:
    """
    Event identity used for cluster matching.
    Generated from the seed article's NER output and updated as new
    content arrives.
    """
    primary_entities: list[str] = field(default_factory=list)  # persons, orgs, locations
    event_action:     str       = ""    # strike, announcement, arrest …
    event_date:       str       = ""    # extracted from metadata or NER time entities
    event_title:      str       = ""    # translated (English) title for semantic matching


# ─────────────────────────────────────────────────────────────────────────────
#  §4.2 — Cluster State
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ClusterState:
    """
    Full lifecycle state for an event cluster.
    """
    cluster_id:          str   = field(default_factory=lambda: str(uuid.uuid4()))
    fingerprint:         ClusterFingerprint = field(default_factory=ClusterFingerprint)
    status:              str   = "active"   # active | closed | ongoing
    created_at:          str   = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_updated:        str   = ""
    close_threshold_h:   int   = 72        # hours before auto-close
    topic_category:      str   = ""
    # Source tracking
    source_count:        int   = 0
    article_ids:         list[str] = field(default_factory=list)
    outlets:             list[str] = field(default_factory=list)
    # All sentence mappings in this cluster
    sentence_ids:        list[str] = field(default_factory=list)
    # Fact objects after deduplication
    fact_ids:            list[str] = field(default_factory=list)
    # Synthesis state
    synthesis_ready:     bool  = False   # True when source_count >= 2
    synthesis_text:      str   = ""      # latest synthesis JSON string
    synthesis_version:   int   = 0       # increments on each re-synthesis
    follow_up_queue:     list[str] = field(default_factory=list)  # article_ids arriving after close

    def to_dict(self) -> dict:
        d = asdict(self)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "ClusterState":
        fp_data = d.pop("fingerprint", {})
        obj = cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})
        obj.fingerprint = ClusterFingerprint(**{
            k: v for k, v in fp_data.items()
            if k in ClusterFingerprint.__dataclass_fields__
        })
        return obj


# ─────────────────────────────────────────────────────────────────────────────
#  §9.2 — Hover Payload
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SourceReference:
    """One source contributing to a synthesis sentence."""
    outlet:           str  = ""
    article_title:    str  = ""
    url:              str  = ""
    published_at:     str  = ""
    original_text:    str  = ""    # verbatim in native language
    translated_text:  str  = ""    # English translation
    char_start:       int  = 0
    char_end:         int  = 0
    verified:         bool = False  # was original text found at these offsets
    credibility:      str  = "outlet-level"


@dataclass
class HoverPayload:
    """
    Per-sentence attribution data served to the hover interface.
    Each synthesis sentence gets one HoverPayload.
    """
    summary_sentence_id: str                = ""
    summary_text:        str                = ""
    sources:             list[SourceReference] = field(default_factory=list)
    confirmation_count:  int                = 0
    contradiction_note:  str                = ""
    section:             str                = ""

    def to_dict(self) -> dict:
        return asdict(self)


# ─────────────────────────────────────────────────────────────────────────────
#  §12 — Full Synthesis Output
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SynthesisOutput:
    """
    Complete output for one cluster — the final product of the pipeline.
    """
    cluster_id:             str        = ""
    topic:                  str        = ""
    event_date:             str        = ""
    synthesis_generated_at: str        = ""
    source_count:           int        = 0
    outlets:                list[str]  = field(default_factory=list)
    # sections{}: section_label → list of {text, fact_indices, confirmation_count}
    sections:               dict[str, list[dict]] = field(default_factory=dict)
    # Per-sentence hover payloads
    hover_payloads:         list[dict] = field(default_factory=list)
    # Bias distribution
    bias_distribution:      dict[str, float] = field(default_factory=dict)
    coverage_gaps:          list[str]  = field(default_factory=list)
    outlet_profiles:        dict[str, dict] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


# ─────────────────────────────────────────────────────────────────────────────
#  §10 — Outlet Profile (Admin-Managed)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class OutletProfile:
    """
    Admin-managed outlet metadata surfaced to journalists on hover.
    """
    name:               str        = ""
    country:            str        = ""
    ownership:          str        = ""
    funding_source:     str        = ""   # private | state-funded | publicly funded | NGO
    political_leaning:  str        = ""   # left | centre-left | centre | centre-right | right | state | religious | nationalist
    known_biases:       list[str]  = field(default_factory=list)
    credibility_tier:   int        = 3    # 1 (major intl) | 2 (regional) | 3 (unverified)
    languages:          list[str]  = field(default_factory=list)
    fact_check_record:  str        = ""
    notes:              str        = ""
    last_updated:       str        = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "OutletProfile":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})