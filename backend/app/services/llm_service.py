"""
GlobeLens AI — LLMService
Integrates Claude/GPT to generate summaries, detect bias, extract geo/topics.
Pipeline Step 4: CLUSTERED → PROCESSED
"""
from typing import Optional

from app.core.config import settings


class LLMService:
    """
    Facade over LLM providers (Anthropic Claude / OpenAI GPT).
    Selects the active provider from settings.LLM_PROVIDER.
    """

    async def generate_summary(self, articles_text: list[str]) -> str:
        """
        Synthesize an objective multi-source summary from clustered articles.
        Returns an authoritative consolidated summary with source attribution.
        """
        # TODO: Build prompt from articles_text, call Claude/GPT, parse response
        raise NotImplementedError

    async def generate_title(self, summary: str) -> str:
        """Generate a concise, neutral event title from the summary."""
        raise NotImplementedError

    async def detect_country(self, text: str) -> Optional[str]:
        """Extract the primary geographic focus country from article text."""
        raise NotImplementedError

    async def extract_topic(self, text: str) -> Optional[str]:
        """Classify the article into a high-level topic category."""
        raise NotImplementedError

    async def detect_bias(self, text: str) -> str:
        """
        Return a BiasLean enum string (LEFT / CENTER / RIGHT etc.)
        for the given article text using LLM classification.
        """
        raise NotImplementedError
