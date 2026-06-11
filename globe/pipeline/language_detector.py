"""
Language Detection Module
Uses the locally saved XLM-RoBERTa language detection model.
Detects language and maps to NLLB language codes for translation.
"""

import logging
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline as hf_pipeline,
)
import torch

logger = logging.getLogger(__name__)

# Mapping from XLM-RoBERTa label → NLLB language code
LANG_TO_NLLB: dict[str, str] = {
    "en": "eng_Latn",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "es": "spa_Latn",
    "it": "ita_Latn",
    "pt": "por_Latn",
    "nl": "nld_Latn",
    "pl": "pol_Latn",
    "ru": "rus_Cyrl",
    "ar": "arb_Arab",
    "zh": "zho_Hans",
    "tr": "tur_Latn",
    "ro": "ron_Latn",
    "hu": "hun_Latn",
    "cs": "ces_Latn",
    "sk": "slk_Latn",
    "bg": "bul_Cyrl",
    "hr": "hrv_Latn",
    "da": "dan_Latn",
    "fi": "fin_Latn",
    "el": "ell_Grek",
    "et": "est_Latn",
    "lv": "lvs_Latn",
    "lt": "lit_Latn",
    "mt": "mlt_Latn",
    "sl": "slv_Latn",
    "sv": "swe_Latn",
    "uk": "ukr_Cyrl",
    "he": "heb_Hebr",
    "no": "nob_Latn",
    "eu": "eus_Latn",
    "ca": "cat_Latn",
    "sq": "als_Latn",
}


class LanguageDetector:
    """
    Detects the language of text using a locally saved XLM-RoBERTa model.
    Supports 41 languages including all major EU and world languages.
    """

    def __init__(self, model_path: str):
        model_path = str(model_path).replace("\\", "/")
        logger.info(f"Loading language detector from: {model_path}")
        tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_path, 
            local_files_only=True,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
        )
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        self.classifier = hf_pipeline(
            "text-classification",
            model=model,
            tokenizer=tokenizer,
            top_k=1,
            device=0 if torch.cuda.is_available() else -1,
        )
        logger.info(f"Language detector ready on {device}.")

    def detect(self, text: str) -> tuple[str, float]:
        """
        Detect the language of the given text.

        Args:
            text: Input text (will be truncated to 500 chars for speed)

        Returns:
            Tuple of (language_code, confidence_score)
            e.g. ("fr", 0.9987)
        """
        text_sample = text[:500].strip()
        if not text_sample:
            return "en", 0.0

        try:
            results = self.classifier(text_sample)
            # results may be [[{...}]] or [{...}] depending on top_k
            top = results[0] if isinstance(results[0], dict) else results[0][0]
            lang = top["label"]
            score = float(top["score"])
            return lang, score
        except Exception as exc:
            logger.warning(f"Language detection failed: {exc}. Defaulting to 'en'.")
            return "en", 0.0

    def get_nllb_code(self, lang_code: str) -> str:
        """Convert a detected language code to its NLLB translation code."""
        return LANG_TO_NLLB.get(lang_code, "eng_Latn")
