"""
Summarization Module — LLM Synthesis
======================================
Implements §8 of the pipeline spec.

The LLM receives a structured digest of fact objects, not raw text.
Its role is curation and connection — choosing which facts to surface
in which section, writing neutral journalistic connectors, and flagging
contradictions. It never generates factual content independently.

Supports three synthesis modes (§8.2 - §8.4):
  • First Synthesis
  • Incremental Re-synthesis
  • Follow-Up Synthesis
"""

import json
import logging
import re
import requests
from typing import Any

from pipeline.data_models import FactObject, ClusterState, SECTION_LABELS

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
#  Prompt templates
# ─────────────────────────────────────────────────────────────

BASE_SYSTEM_PROMPT = """\
You are an expert journalistic synthesis engine for GlobeLens AI.
Your task is to synthesize verified fact objects from multiple news sources into a single, coherent, neutral journalistic report.
You NEVER generate facts independently. You ONLY use the provided facts.
You must output a valid JSON object.

The output JSON must have a "sections" key containing an object where each key is a section label, and the value is an array of sentence objects.
Section labels must be chosen ONLY from this list:
{sections_list}

Each sentence object in the array MUST have this exact structure:
{{
  "text": "The synthesized sentence text.",
  "fact_indices": [1, 2],
  "confirmation_count": 5
}}
- "fact_indices": array of integers representing the [Index] of the facts used to construct this sentence.
- "confirmation_count": the maximum confirmation count among the facts used.

Maintain a neutral, objective, and academic journalistic tone. Do not use sensationalist language.
Embed confirmation counts naturally in the text when relevant (e.g., "The strike was confirmed by 5 outlets.").

CRITICAL COVERAGE RULES — you MUST follow these:
1. Do NOT omit geopolitical qualifications, structural ambiguities, or funding/mechanism details even if they appear in only one source. Flag them as single-source but include them.
2. Any fact marked FLAG: EXCLUSIVE or flagged_single_source=True must appear in the synthesis, placed in the most appropriate section, with a note indicating it comes from a single source.
3. When contradiction pairs appear (CONTRADICTION — A vs B), represent both sides explicitly in the output rather than suppressing either claim. Place contradictions in the section that best matches their content.
4. Numeric claims (amounts, percentages, quantities) must always be surfaced, even from single sources. Place them in "Numbers & Data" with a single-source caveat if needed.
"""

FIRST_SYNTHESIS_PROMPT = """\
{system_prompt}

Here is the structured digest of facts for this event cluster:

{facts_digest}

{bias_summary}

Construct the full synthesis JSON. Group facts into the appropriate epistemic sections based on their content and flags.
"""

RE_SYNTHESIS_PROMPT = """\
{system_prompt}

This is an INCREMENTAL RE-SYNTHESIS. New facts have arrived for an active event cluster.
You must integrate the NEW facts into the EXISTING synthesis.
Do NOT discard the existing synthesis; expand it, update confirmation counts where facts are now better corroborated, and add new sections if needed.

EXISTING SYNTHESIS:
```json
{existing_synthesis}
```

NEW FACTS TO INTEGRATE:
{facts_digest}

{bias_summary}

Construct the updated synthesis JSON.
"""

FOLLOW_UP_PROMPT = """\
{system_prompt}

This is a FOLLOW-UP SYNTHESIS. New facts have arrived for a CLOSED event cluster (older than 72 hours).
You must NOT modify the existing synthesis. You must ONLY generate a new "Follow-Up" section using the new facts.

EXISTING SYNTHESIS CONTEXT (Do not modify or output this):
```json
{existing_synthesis}
```

FOLLOW-UP FACTS:
{facts_digest}

Return a JSON object containing ONLY the "Follow-Up" section.
"""


class Summarizer:
    """
    Journalism-grade synthesizer powered by a local Ollama LLM.
    Handles multi-source fact synthesis with section taxonomy.
    """

    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        model: str = "aya-expanse:8b",
        temperature: float = 0.1,
        timeout: int = 300,
        num_gpu: int = 99,        # layers to offload to GPU (99 = all; Ollama caps at actual layer count)
        num_ctx: int = 8192,      # context window; remaining tokens overflow to CPU automatically
    ):
        self.ollama_url = ollama_url.rstrip("/")
        self.model = model
        self.temperature = temperature
        self.timeout = timeout
        self.num_gpu = num_gpu
        self.num_ctx = num_ctx
        logger.info(
            f"Synthesizer ready — Ollama model: {model} @ {ollama_url} "
            f"(num_gpu={num_gpu}, num_ctx={num_ctx})"
        )

    def synthesize(
        self,
        cluster: ClusterState,
        facts: list[FactObject],
        bias_summary: dict[str, Any],
        mode: str = "first",
    ) -> dict[str, list[dict]]:
        """
        Synthesize facts into a sectioned report.

        Args:
            cluster:      The ClusterState object.
            facts:        List of FactObjects to synthesize (all facts for first/re-synthesis,
                          only new facts for follow-up).
            bias_summary: Cluster-level bias aggregation.
            mode:         "first" | "re_synthesis" | "follow_up"

        Returns:
            Dictionary of section_label -> list of sentence dicts.
            e.g., {"Verified Facts": [{"text": "...", "fact_indices": [0], "confirmation_count": 3}]}
        """
        if not facts:
            logger.warning("No facts provided for synthesis.")
            return {}

        system_prompt = BASE_SYSTEM_PROMPT.format(
            sections_list="\n".join(f"- {s}" for s in SECTION_LABELS)
        )

        facts_digest = self._build_facts_digest(facts)
        bias_text = self._build_bias_summary_text(bias_summary)

        if mode == "first":
            prompt = FIRST_SYNTHESIS_PROMPT.format(
                system_prompt=system_prompt,
                facts_digest=facts_digest,
                bias_summary=bias_text,
            )
        elif mode == "re_synthesis":
            prompt = RE_SYNTHESIS_PROMPT.format(
                system_prompt=system_prompt,
                existing_synthesis=cluster.synthesis_text,
                facts_digest=facts_digest,
                bias_summary=bias_text,
            )
        elif mode == "follow_up":
            prompt = FOLLOW_UP_PROMPT.format(
                system_prompt=system_prompt,
                existing_synthesis=cluster.synthesis_text,
                facts_digest=facts_digest,
            )
        else:
            raise ValueError(f"Unknown synthesis mode: {mode}")

        try:
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model":  self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature":  self.temperature,
                        "top_p":        0.9,
                        "num_predict":  2000,
                        "num_gpu":      self.num_gpu,   # offload layers to GPU; excess tokens spill to CPU
                        "num_ctx":      self.num_ctx,   # full context window; GPU handles up to VRAM limit
                    },
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            raw_text = response.json().get("response", "").strip()
            parsed = self._parse_json(raw_text)
            
            # Extract sections dict. The prompt asks for {"sections": {...}}
            sections = parsed.get("sections", parsed)
            max_sources = max(cluster.source_count, 1)
            return self._normalize_sections(sections, facts, max_sources=max_sources)

        except Exception as exc:
            logger.error(f"Synthesis failed ({mode}): {exc}")
            return self._fallback_synthesis(facts)

    def _build_facts_digest(self, facts: list[FactObject]) -> str:
        """
        Format fact objects into a structured digest for the LLM prompt.

        Handles both legacy contradiction format ({outlet, text}) and the new
        structured A-vs-B pair format ({type, claim_a, claim_b, nature})
        produced by Compressor.detect_contradictions().
        """
        lines = []
        for i, f in enumerate(facts):
            # Index is important for the LLM to reference back via fact_indices
            lines.append(f"[Index: {i}]")
            lines.append(f"Fact: {f.fact}")
            lines.append(f"Section Suggestion: {f.section_flag or 'Verified Facts'}")
            lines.append(f"Confirmed By ({f.confirmation_count}): {', '.join(f.confirmed_by)}")

            if f.unique_to:
                lines.append(
                    f"FLAG: EXCLUSIVE TO {f.unique_to} — include in synthesis with "
                    f"single-source caveat; do NOT omit."
                )

            # Coverage-floor reinstated facts (dropped numeric/geopolitical claims)
            if getattr(f, "flagged_single_source", False):
                lines.append(
                    "FLAG: SINGLE-SOURCE NUMERIC/GEOPOLITICAL CLAIM — "
                    "must appear in synthesis; caveat as unconfirmed by other outlets."
                )

            if f.short_post_confirmations:
                lines.append(f"Social Signals: {', '.join(f.short_post_confirmations)}")

            if f.contradicted_by:
                for contra in f.contradicted_by:
                    if isinstance(contra, dict):
                        if contra.get("type") == "contradiction":
                            # New structured A-vs-B format
                            claim_a = contra.get("claim_a", {})
                            claim_b = contra.get("claim_b", {})
                            nature  = contra.get("nature", "conflict")
                            lines.append(
                                f"CONTRADICTION ({nature}) — "
                                f"A: [{claim_a.get('source', '?')}] \"{claim_a.get('text', '')}\" "
                                f"vs "
                                f"B: [{claim_b.get('source', '?')}] \"{claim_b.get('text', '')}\""
                            )
                        else:
                            # Legacy format: {outlet, text}
                            lines.append(
                                f"CONTRADICTION FLAG: Outlet '{contra.get('outlet', '?')}' "
                                f"claims: {contra.get('text', '')}"
                            )

            lines.append("")  # blank line separator

        return "\n".join(lines)

    def _build_bias_summary_text(self, bias_summary: dict[str, Any]) -> str:
        """Format the bias distribution map for the Analysis section instruction."""
        if not bias_summary or "bias_frequency_map" not in bias_summary:
            return ""
        
        freq_map = bias_summary["bias_frequency_map"]
        if not freq_map:
            return ""
            
        lines = ["CLUSTER BIAS SUMMARY (Integrate this into the 'Analysis & Interpretation' section):"]
        for direction, pct in freq_map.items():
            lines.append(f"- {direction.capitalize()}: {pct}%")
            
        if bias_summary.get("loaded_terms"):
            terms = bias_summary["loaded_terms"][:10]
            lines.append(f"Loaded terms detected: {', '.join(terms)}")
            
        return "\n".join(lines)

    def _parse_json(self, raw: str) -> dict:
        """Extract JSON from LLM response."""
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"\s*```$",           "", raw, flags=re.MULTILINE)

        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start == -1 or end <= 1:
            raise ValueError("No JSON object found in LLM response.")

        json_str = raw[start:end]
        return json.loads(json_str)

    def _normalize_sections(
        self,
        sections: dict,
        facts: list[FactObject],
        max_sources: int | None = None,
    ) -> dict[str, list[dict]]:
        """Ensure the output conforms strictly to the schema."""
        normalized = {}
        for sec_name, sentences in sections.items():
            # Soft-match section names in case the LLM slightly altered them
            matched_sec = sec_name
            for valid_sec in SECTION_LABELS:
                if valid_sec.lower() in sec_name.lower() or sec_name.lower() in valid_sec.lower():
                    matched_sec = valid_sec
                    break
                    
            if not isinstance(sentences, list):
                continue
                
            norm_sentences = []
            for sent in sentences:
                if not isinstance(sent, dict) or "text" not in sent:
                    continue
                
                fact_indices = sent.get("fact_indices", [])
                if not isinstance(fact_indices, list):
                    fact_indices = [fact_indices]
                
                # Filter invalid indices
                valid_indices = [i for i in fact_indices if isinstance(i, int) and 0 <= i < len(facts)]
                
                # Compute real confirmation count based on cited facts
                conf_count = 1
                if valid_indices:
                    conf_count = max(facts[i].confirmation_count for i in valid_indices)
                if max_sources is not None and max_sources > 0:
                    conf_count = min(conf_count, max_sources)
                    
                norm_sentences.append({
                    "text": sent["text"],
                    "fact_indices": valid_indices,
                    "confirmation_count": conf_count
                })
                
            if norm_sentences:
                normalized[matched_sec] = norm_sentences
                
        return normalized

    def _fallback_synthesis(self, facts: list[FactObject]) -> dict[str, list[dict]]:
        """Simple fallback organizing facts into sections without LLM rewriting."""
        sections = {}
        for i, fact in enumerate(facts):
            sec = fact.section_flag.replace(" [CONTRADICTION]", "")
            if sec not in SECTION_LABELS:
                sec = "Verified Facts"
                
            if sec not in sections:
                sections[sec] = []
                
            sections[sec].append({
                "text": fact.fact,
                "fact_indices": [i],
                "confirmation_count": fact.confirmation_count
            })
        return sections