"""
Translation Module — NLLB (No Language Left Behind)
====================================================
Translates any supported language to English using the locally saved NLLB model.

Two modes of operation:
  • translate()            — legacy whole-text translation (backward compat)
  • translate_sentences()  — sentence-level translation producing SentenceMapping
                             objects with original↔translation pairing (§3.2)

English articles skip the translation call entirely — language detection routes
them directly.  Every translated sentence is immediately paired with its original
before any further processing.
"""

import logging
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

logger = logging.getLogger(__name__)


class Translator:
    """
    Multilingual translator using Facebook's NLLB model (200+ languages).
    Loaded fully offline from the local model directory.

    GPU/CPU split strategy:
      - Model weights are loaded in float16 on GPU for maximum throughput.
      - When a batch exceeds GPU memory, the encoder runs on GPU and the
        decoder falls back to CPU for the overflow tokens automatically via
        the 'device_map="auto"' dispatch table (set at init time).
      - If CUDA is unavailable the model runs entirely on CPU in float32.
    """

    def __init__(self, model_path: str, device: str = None):
        model_path = str(model_path).replace("\\", "/")
        logger.info(f"Loading NLLB translator from: {model_path}")
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_path, local_files_only=True
        )

        cuda_available = torch.cuda.is_available()

        if cuda_available:
            # device_map="auto" places layers on GPU first, then overflows to CPU.
            # This lets long sequences finish on CPU instead of OOM-crashing.
            self.model = AutoModelForSeq2SeqLM.from_pretrained(
                model_path,
                local_files_only=True,
                dtype=torch.float16,
                device_map="auto",   # GPU primary, CPU overflow
            )
            # device_map="auto" manages placement; self.device drives tokenizer .to()
            self.device = "cuda"
            logger.info("NLLB translator loaded with device_map=auto (GPU primary, CPU overflow).")
        else:
            self.model = AutoModelForSeq2SeqLM.from_pretrained(
                model_path,
                local_files_only=True,
                torch_dtype=torch.float32,
            )
            self.device = "cpu"
            self.model = self.model.to(self.device)
            logger.info("NLLB translator loaded on CPU (no CUDA detected).")

        self.model.eval()
        logger.info(f"NLLB translator ready on {self.device}.")

    # ─── Sentence-level translation (§3.2) ───────────────────────────────────

    def translate_sentences(
        self,
        sentence_mappings: list,
        skip_english: bool = True,
    ) -> list:
        """
        Translate a list of SentenceMapping objects, filling in translated_text.

        English sentences (original_lang == 'eng_Latn') skip translation —
        their translated_text is set to the original.

        Args:
            sentence_mappings: List of SentenceMapping dataclass instances
                               with original_text and original_lang set.
            skip_english:      If True, skip translation for English text.

        Returns:
            The same list with translated_text filled in for each mapping.
        """
        from collections import defaultdict
        
        translated_count = 0
        skipped_count = 0

        # Group mappings by source language
        lang_groups = defaultdict(list)
        for mapping in sentence_mappings:
            if skip_english and mapping.original_lang == "eng_Latn":
                mapping.translated_text = mapping.original_text
                skipped_count += 1
            else:
                lang_groups[mapping.original_lang].append(mapping)

        # Batch translate per language group
        for src_lang, mappings_group in lang_groups.items():
            texts = [m.original_text for m in mappings_group]
            try:
                translated_texts = self._translate_batch(texts, src_lang=src_lang)
                for mapping, translated in zip(mappings_group, translated_texts):
                    mapping.translated_text = translated
                    translated_count += 1
            except Exception as exc:
                logger.warning(f"Batch translation failed for lang {src_lang}: {exc}. Keeping original texts.")
                for mapping in mappings_group:
                    mapping.translated_text = mapping.original_text

        logger.info(
            f"Batched translation: {translated_count} sentences translated, "
            f"skipped {skipped_count} (English)."
        )
        return sentence_mappings

    def _translate_batch(
        self,
        texts: list[str],
        src_lang: str,
        tgt_lang: str = "eng_Latn",
        max_new_tokens: int = 256,
        num_beams: int = 1,
        batch_size: int = 32,
    ) -> list[str]:
        """Translate a batch of sentences."""
        self.tokenizer.src_lang = src_lang
        forced_bos_id = self.tokenizer.convert_tokens_to_ids(tgt_lang)

        # With device_map="auto", inputs must go to the model's first device.
        # model.device gives that device (GPU:0 when available).
        input_device = self.model.device

        all_translated = []
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            inputs = self.tokenizer(
                batch_texts,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512,
            ).to(input_device)

            with torch.no_grad():
                output_ids = self.model.generate(
                    **inputs,
                    forced_bos_token_id=forced_bos_id,
                    max_new_tokens=max_new_tokens,
                    num_beams=num_beams,
                    use_cache=True,
                )

            batch_translated = self.tokenizer.batch_decode(
                output_ids, skip_special_tokens=True
            )
            all_translated.extend([t.strip() for t in batch_translated])
            
        return all_translated

    # ─── Legacy whole-text translation (backward compat) ─────────────────────

    def translate(
        self,
        text: str,
        src_lang: str,
        tgt_lang: str = "eng_Latn",
        max_chunk_chars: int = 700,
        max_new_tokens: int = 512,
        num_beams: int = 4,
    ) -> str:
        """
        Translate text from src_lang to tgt_lang using NLLB language codes.

        Args:
            text:             Input text to translate
            src_lang:         NLLB source language code  e.g. "fra_Latn"
            tgt_lang:         NLLB target language code  (default: English)
            max_chunk_chars:  Max characters per translation chunk
            max_new_tokens:   Max tokens in translated output per chunk
            num_beams:        Beam search width

        Returns:
            Translated text as a single string
        """
        chunks = self._split_into_chunks(text, max_chars=max_chunk_chars)
        self.tokenizer.src_lang = src_lang
        forced_bos_id = self.tokenizer.convert_tokens_to_ids(tgt_lang)

        translated_parts: list[str] = []

        for i, chunk in enumerate(chunks):
            try:
                inputs = self.tokenizer(
                    chunk,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                    max_length=512,
                ).to(self.model.device)

                with torch.no_grad():
                    output_ids = self.model.generate(
                        **inputs,
                        forced_bos_token_id=forced_bos_id,
                        max_new_tokens=max_new_tokens,
                        num_beams=num_beams,
                        early_stopping=True,
                    )

                translated = self.tokenizer.decode(
                    output_ids[0], skip_special_tokens=True
                )
                translated_parts.append(translated.strip())
                logger.debug(f"  Chunk {i+1}/{len(chunks)} translated.")

            except Exception as exc:
                logger.warning(f"  Translation chunk {i+1} failed: {exc}. Keeping original.")
                translated_parts.append(chunk)

        return " ".join(translated_parts)

    def _split_into_chunks(self, text: str, max_chars: int = 700) -> list[str]:
        """
        Split text into sentence-aware chunks that fit within max_chars.
        Falls back to paragraph or hard splits if needed.
        """
        # Normalize whitespace
        text = " ".join(text.split())

        # Try to split on sentence endings
        import re
        sentence_endings = re.compile(r'(?<=[.!?])\s+')
        sentences = sentence_endings.split(text)

        chunks: list[str] = []
        current = ""

        for sentence in sentences:
            if not sentence.strip():
                continue
            if len(current) + len(sentence) + 1 <= max_chars:
                current = (current + " " + sentence).strip()
            else:
                if current:
                    chunks.append(current)
                # If single sentence is too long, hard-split it
                if len(sentence) > max_chars:
                    for start in range(0, len(sentence), max_chars):
                        chunks.append(sentence[start : start + max_chars])
                    current = ""
                else:
                    current = sentence

        if current:
            chunks.append(current)

        return chunks if chunks else [text[:max_chars]]
