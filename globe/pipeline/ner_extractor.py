"""
Named Entity Recognition Module
=================================
Uses locally saved XLM-RoBERTa-large NER model.
Extracts: PER (persons), ORG (organizations), LOC (locations), DATE (dates).
Works on multilingual text — runs on native text BEFORE translation (§3.1).

Two operation modes:
  • extract()              — legacy whole-text NER (backward compat)
  • extract_from_sentences() — per-sentence NER that attaches entities to
                               SentenceMapping objects
  • extract_fingerprint()  — extract event fingerprint components for clustering (§4.1)
"""

import logging
import re
from transformers import (
    AutoTokenizer,
    AutoModelForTokenClassification,
    pipeline as hf_pipeline,
)

logger = logging.getLogger(__name__)

# Human-readable label names
LABEL_DISPLAY: dict[str, str] = {
    "PER": "Person",
    "ORG": "Organization",
    "LOC": "Location",
    "DATE": "Date",
}

# Common event action verbs for fingerprint extraction
EVENT_VERBS = {
    "strike", "struck", "attack", "attacked", "bomb", "bombed", "shell", "shelled",
    "announce", "announced", "declare", "declared", "sign", "signed",
    "arrest", "arrested", "detain", "detained", "sentence", "sentenced",
    "kill", "killed", "die", "died", "injure", "injured", "wound", "wounded",
    "protest", "protested", "rally", "march", "marched",
    "elect", "elected", "vote", "voted", "appoint", "appointed",
    "resign", "resigned", "dismiss", "dismissed", "fire", "fired",
    "invade", "invaded", "occupy", "occupied", "seize", "seized",
    "negotiate", "negotiated", "agree", "agreed", "reject", "rejected",
    "sanction", "sanctioned", "ban", "banned", "embargo",
    "launch", "launched", "deploy", "deployed", "withdraw", "withdrew",
    "collapse", "collapsed", "explode", "exploded", "crash", "crashed",
    "discover", "discovered", "reveal", "revealed", "leak", "leaked",
    "confirm", "confirmed", "deny", "denied", "claim", "claimed",
}


class NERExtractor:
    """
    Multilingual Named Entity Recognizer using XLM-RoBERTa-large.
    Supports 100+ languages out of the box.
    Entity types: PER, ORG, LOC, DATE
    """

    def __init__(self, model_path: str, chunk_size: int = 400):
        model_path = str(model_path).replace("\\", "/")
        logger.info(f"Loading NER model from: {model_path}")
        # Load model + tokenizer explicitly (local_files_only not supported
        # as a pipeline() kwarg in transformers >= 4.40)
        import torch
        tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        model = AutoModelForTokenClassification.from_pretrained(
            model_path, 
            local_files_only=True,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
        )
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        device_id = 0 if torch.cuda.is_available() else -1
        self.ner_pipeline = hf_pipeline(
            "token-classification",
            model=model,
            tokenizer=tokenizer,
            aggregation_strategy="simple",
            device=device_id,
        )
        self.chunk_size = chunk_size
        logger.info(f"NER model ready on {device}.")

    # ─── Sentence-level NER (§3.1) ───────────────────────────────────────────

    def extract_from_sentences(self, sentence_mappings: list) -> list:
        """
        Run NER on each SentenceMapping's original_text (native language)
        in batches and attach the entities list to each mapping.
        """
        total_entities = 0
        texts = [m.original_text for m in sentence_mappings]
        
        # Run inference in a batch
        try:
            batch_results = self.ner_pipeline(texts, batch_size=32)
        except Exception as exc:
            logger.warning(f"Batched NER failed: {exc}. Falling back to empty entities.")
            batch_results = [[] for _ in texts]
            
        for mapping, raw in zip(sentence_mappings, batch_results):
            all_entities = []
            for ent in raw:
                entity_text = ent.get("word", "").strip()
                if len(entity_text) < 2 or ent.get("score", 0) < 0.5:
                    continue
                # Clean up tokenizer artefacts
                entity_text = re.sub(r"^[▁#]+", "", entity_text).strip()
                if not entity_text:
                    continue

                all_entities.append({
                    "text":  entity_text,
                    "label": ent.get("entity_group", "O"),
                    "score": round(float(ent.get("score", 0)), 4),
                    "start": ent.get("start", 0),
                    "end":   ent.get("end", 0),
                })
            
            unique = self._deduplicate(all_entities)
            mapping.entities = unique
            total_entities += len(unique)

        logger.info(
            f"NER batched extraction found {total_entities} entities from "
            f"{len(sentence_mappings)} sentences."
        )
        return sentence_mappings

    # ─── Entity validation (anti-corruption guard) ───────────────────────────

    @staticmethod
    def is_valid_entity(text: str) -> bool:
        """
        Validate that an entity string is a real noun-phrase entity and not
        a translation artifact / hallucination fragment.

        Rules:
          - Max 6 tokens (entity names are short noun phrases)
          - Must not start with a first-person or impersonal pronoun
            (NLLB hallucinations often produce "I 'm going to…" style fragments)
          - Must not contain sentence-ending punctuation inside the string
            (indicates a full sentence leaked in)
          - Must not be purely numeric / whitespace
        """
        if not text or not text.strip():
            return False
        tokens = text.split()
        if len(tokens) > 6:
            return False
        # Reject strings that start with common translation-artifact pronouns
        ARTIFACT_STARTERS = {
            "i", "we", "they", "it", "he", "she", "you",
            "this", "that", "these", "those",
        }
        if tokens[0].lower() in ARTIFACT_STARTERS:
            return False
        # Reject if the string contains mid-string sentence punctuation
        # (a sign that a full sentence slipped through)
        import re as _re
        if _re.search(r'[.!?](?!\s*$)', text):
            return False
        return True

    def extract_fingerprint(
        self,
        sentence_mappings: list,
        article_title: str = "",
    ) -> dict:
        """
        Extract event fingerprint components from all sentences in an article.
        Used for cluster matching (§4.1).

        IMPORTANT: entity strings come from NER on *native* text only
        (mapping.entities were populated by extract_from_sentences which
        runs on original_text). The translated_text is used only to build
        the all_text blob for event-verb extraction — it is NOT re-fed
        to NER, which prevents NLLB hallucination fragments from leaking
        into the entity list.

        Returns:
            {
                "primary_entities": [str, ...],  # validated persons, orgs, locs
                "event_action": str,             # most prominent event verb
                "event_date": str,               # date from NER or empty
            }
        """
        all_entities = []
        # Use translated text for verb extraction only (English vocabulary)
        all_text = article_title + " "

        for mapping in sentence_mappings:
            # Entities are always from native-text NER — never re-run on translation
            all_entities.extend(mapping.entities)
            text_to_use = mapping.translated_text if mapping.translated_text else mapping.original_text
            all_text += text_to_use + " "

        # Collect unique entities by type — apply validation filter
        raw_persons = list({e["text"] for e in all_entities if e["label"] == "PER"})
        raw_orgs    = list({e["text"] for e in all_entities if e["label"] == "ORG"})
        raw_locs    = list({e["text"] for e in all_entities if e["label"] == "LOC"})
        dates       = list({e["text"] for e in all_entities if e["label"] == "DATE"})

        persons = [e for e in raw_persons if self.is_valid_entity(e)]
        orgs    = [e for e in raw_orgs    if self.is_valid_entity(e)]
        locs    = [e for e in raw_locs    if self.is_valid_entity(e)]

        primary_entities = persons[:5] + orgs[:5] + locs[:5]

        # Fallback: if all entities were filtered out, try to derive a label
        # from the article title itself (first noun phrase, max 3 words).
        if not primary_entities and article_title:
            import re as _re
            words = _re.findall(r'\b[A-Z][a-z]+\b', article_title)
            if words:
                primary_entities = [" ".join(words[:3])]
                logger.debug(
                    f"All entities filtered by is_valid_entity; "
                    f"falling back to title noun: {primary_entities}"
                )

        # Find event action verb (English translated text is fine here)
        event_action = self._extract_event_verb(all_text)

        # Event date: prefer NER-extracted dates, fall back to empty
        event_date = dates[0] if dates else ""

        if not persons and not orgs and not locs:
            logger.warning(
                "extract_fingerprint: all raw entities failed is_valid_entity validation. "
                f"Raw persons={raw_persons[:3]}, orgs={raw_orgs[:3]}, locs={raw_locs[:3]}"
            )

        return {
            "primary_entities": primary_entities,
            "event_action": event_action,
            "event_date": event_date,
        }

    def _extract_event_verb(self, text: str) -> str:
        """Find the most prominent event verb in the text."""
        text_lower = text.lower()
        words = re.findall(r'\b\w+\b', text_lower)
        verb_counts: dict[str, int] = {}
        for word in words:
            if word in EVENT_VERBS:
                # Normalize to base form (simple heuristic)
                base = word.rstrip("ed").rstrip("s") if word.endswith("ed") or word.endswith("s") else word
                verb_counts[base] = verb_counts.get(base, 0) + 1

        if not verb_counts:
            return ""
        return max(verb_counts, key=verb_counts.get)

    # ─── Legacy whole-text NER (backward compat) ─────────────────────────────

    def extract(self, text: str) -> list[dict]:
        """
        Extract named entities from text.

        Args:
            text: Input text (any supported language)

        Returns:
            List of entity dicts:
            {
              "text":  str,          # entity surface form
              "label": str,          # PER | ORG | LOC | DATE
              "score": float,        # confidence [0–1]
              "start": int,          # char offset in original text
              "end":   int,
            }
        """
        chunks = self._split_into_chunks(text)
        all_entities: list[dict] = []
        char_offset = 0

        for chunk_text in chunks:
            try:
                raw = self.ner_pipeline(chunk_text)
                for ent in raw:
                    # Filter noise: skip very short tokens and low-confidence
                    entity_text = ent.get("word", "").strip()
                    if len(entity_text) < 2 or ent.get("score", 0) < 0.5:
                        continue
                    # Clean up tokenizer artefacts (▁, ##, etc.)
                    entity_text = re.sub(r"^[▁#]+", "", entity_text).strip()
                    if not entity_text:
                        continue

                    all_entities.append({
                        "text":  entity_text,
                        "label": ent.get("entity_group", "O"),
                        "score": round(float(ent.get("score", 0)), 4),
                        "start": ent.get("start", 0) + char_offset,
                        "end":   ent.get("end", 0) + char_offset,
                    })
            except Exception as exc:
                logger.warning(f"NER chunk error (offset={char_offset}): {exc}")

            char_offset += len(chunk_text)

        return self._deduplicate(all_entities)

    def get_entities_by_type(
        self, entities: list[dict], label: str
    ) -> list[str]:
        """Return unique entity texts filtered by label (PER/ORG/LOC/DATE)."""
        return list({
            e["text"] for e in entities if e["label"] == label
        })

    # ─── private helpers ────────────────────────────────────────────────────

    def _split_into_chunks(self, text: str) -> list[str]:
        """Split text into chunks that fit within the model's token budget."""
        text = text.replace("\n", " ").strip()
        sentence_sep = re.compile(r'(?<=[.!?])\s+')
        sentences = sentence_sep.split(text)

        chunks: list[str] = []
        current = ""
        for sentence in sentences:
            if not sentence.strip():
                continue
            if len(current) + len(sentence) + 1 <= self.chunk_size:
                current = (current + " " + sentence).strip()
            else:
                if current:
                    chunks.append(current)
                current = sentence[:self.chunk_size]
        if current:
            chunks.append(current)

        return chunks or [text[:self.chunk_size]]

    def _deduplicate(self, entities: list[dict]) -> list[dict]:
        """Remove duplicate entities (same text + label combination)."""
        seen: set[tuple[str, str]] = set()
        unique: list[dict] = []
        for ent in entities:
            key = (ent["text"].lower(), ent["label"])
            if key not in seen:
                seen.add(key)
                unique.append(ent)
        # Sort by score descending
        return sorted(unique, key=lambda e: e["score"], reverse=True)