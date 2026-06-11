"""
Sentence Splitter Module — spaCy
=================================
Splits articles into sentences **before translation** on native-language text.
Uses spaCy's multilingual xx_sent_ud_sm model.

Short posts, statements, and OSINT posts skip splitting — they are treated
as a single sentence unit per §3.1 of the pipeline spec.
"""

import logging
import re
import uuid

logger = logging.getLogger(__name__)


class SentenceSplitter:
    """
    Multilingual sentence splitter using spaCy xx_sent_ud_sm.
    Falls back to regex-based splitting if spaCy is unavailable.
    """

    def __init__(self):
        self._nlp = None
        try:
            import spacy
            try:
                self._nlp = spacy.load("xx_sent_ud_sm")
                # Increase max length for long articles
                self._nlp.max_length = 200_000
                logger.info("Sentence splitter ready (spaCy xx_sent_ud_sm).")
            except OSError:
                logger.warning(
                    "spaCy model 'xx_sent_ud_sm' not found. "
                    "Falling back to regex sentence splitting."
                )
        except ImportError:
            logger.warning(
                "spaCy not installed. Falling back to regex sentence splitting."
            )

    def split(
        self,
        text: str,
        content_type: str = "article",
    ) -> list[dict]:
        """
        Split text into sentences with character offsets.

        Args:
            text:         Raw article text in native language.
            content_type: "article" | "short_post" | "statement" | "osint"

        Returns:
            List of dicts, each containing:
              - text:       sentence text
              - char_start: start offset in original text
              - char_end:   end offset in original text
        """
        # Short posts, statements, and OSINT skip splitting (§3.1)
        if content_type in ("short_post", "statement", "osint"):
            return [{
                "text":       text.strip(),
                "char_start": 0,
                "char_end":   len(text),
            }]

        if self._nlp is not None:
            return self._split_spacy(text)
        else:
            return self._split_regex(text)

    def _split_spacy(self, text: str) -> list[dict]:
        """Split using spaCy's sentence segmenter."""
        doc = self._nlp(text)
        sentences = []
        for sent in doc.sents:
            sent_text = sent.text.strip()
            if len(sent_text) < 5:
                continue
            sentences.append({
                "text":       sent_text,
                "char_start": sent.start_char,
                "char_end":   sent.end_char,
            })
        if not sentences:
            sentences.append({
                "text":       text.strip(),
                "char_start": 0,
                "char_end":   len(text),
            })
        return sentences

    def _split_regex(self, text: str) -> list[dict]:
        """Regex fallback: split on sentence-ending punctuation."""
        pattern = re.compile(r'(?<=[.!?])\s+')
        parts = pattern.split(text)

        sentences = []
        offset = 0
        for part in parts:
            part_stripped = part.strip()
            if len(part_stripped) < 5:
                offset += len(part) + 1
                continue
            # Find actual position in original text
            start = text.find(part, offset)
            if start == -1:
                start = offset
            end = start + len(part)
            sentences.append({
                "text":       part_stripped,
                "char_start": start,
                "char_end":   end,
            })
            offset = end

        if not sentences:
            sentences.append({
                "text":       text.strip(),
                "char_start": 0,
                "char_end":   len(text),
            })
        return sentences

    def create_sentence_mappings(
        self,
        text: str,
        article_id: str,
        outlet: str,
        url: str,
        article_title: str,
        published_at: str,
        original_lang: str,
        content_type: str = "article",
        credibility: str = "outlet-level",
    ) -> list:
        """
        Split text and produce SentenceMapping objects.

        Returns:
            List of SentenceMapping dataclass instances with all
            pre-translation fields filled in.
        """
        from pipeline.data_models import SentenceMapping

        raw_sentences = self.split(text, content_type=content_type)
        mappings = []

        for sent in raw_sentences:
            mapping = SentenceMapping(
                sentence_id=str(uuid.uuid4()),
                original_text=sent["text"],
                original_lang=original_lang,
                translated_text="",  # filled at translation boundary
                article_id=article_id,
                outlet=outlet,
                url=url,
                article_title=article_title,
                published_at=published_at,
                char_start=sent["char_start"],
                char_end=sent["char_end"],
                content_type=content_type,
                credibility=credibility,
            )
            mappings.append(mapping)

        logger.info(
            f"Split '{article_title[:50]}' into {len(mappings)} sentences "
            f"(type={content_type})"
        )
        return mappings
