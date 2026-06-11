"""
Embedding Module — BGE-M3
Uses the locally saved BAAI/bge-m3 model via sentence-transformers.
Generates dense 1024-dim multilingual embeddings for semantic search.
BGE-M3 supports 100+ languages and is optimised for retrieval tasks.
"""

import logging
import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class Embedder:
    """
    Multilingual dense embedder using BAAI/bge-m3 (sentence-transformers).
    Output dimension: 1024, normalized to unit length for cosine similarity.
    """

    def __init__(self, model_path: str, device: str | None = None):
        model_path = str(model_path).replace("\\", "/")
        logger.info(f"Loading BGE-M3 embedder from: {model_path}")
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = SentenceTransformer(
            model_path,
            local_files_only=True,
            device=self.device,
            model_kwargs={"torch_dtype": torch.float16 if torch.cuda.is_available() else torch.float32}
        )
        self.dim = self.model.get_embedding_dimension()
        logger.info(
            f"BGE-M3 embedder ready on {self.device}. "
            f"Embedding dimension: {self.dim}"
        )

    def embed(self, text: str) -> list[float]:
        """
        Generate a single normalized embedding for a piece of text.

        Args:
            text: Any text (title + summary or full article excerpt)

        Returns:
            List of floats (length = self.dim, e.g. 1024)
        """
        text = text.strip()
        if not text:
            return [0.0] * self.dim

        embedding = self.model.encode(
            text,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return embedding.tolist()

    def embed_batch(
        self,
        texts: list[str],
        batch_size: int = 32,
    ) -> list[list[float]]:
        """
        Generate embeddings for a list of texts efficiently.

        Args:
            texts:      List of text strings
            batch_size: Mini-batch size for the encoder

        Returns:
            List of embedding vectors (one per input text)
        """
        texts = [t.strip() or " " for t in texts]
        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=len(texts) > 10,
            batch_size=batch_size,
            convert_to_numpy=True,
        )
        return [emb.tolist() for emb in embeddings]

    def build_embed_text(
        self,
        title: str,
        summary: str,
        text_excerpt: str = "",
        max_excerpt_chars: int = 400,
    ) -> str:
        """
        Compose an optimised input string for embedding.
        BGE-M3 retrieval quality improves when title + summary are prepended.
        """
        parts = [title.strip()]
        if summary.strip():
            parts.append(summary.strip())
        if text_excerpt.strip():
            parts.append(text_excerpt.strip()[:max_excerpt_chars])
        return " | ".join(parts)
