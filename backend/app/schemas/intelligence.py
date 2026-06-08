"""
GlobeLens AI — Intelligence Validation Schemas
================================================
Validates LLM-generated event intelligence responses.
"""
from enum import Enum
from pydantic import BaseModel, Field, field_validator


class IntelligenceTopic(str, Enum):
    POLITICS = "POLITICS"
    ECONOMY = "ECONOMY"
    TECHNOLOGY = "TECHNOLOGY"
    SPORTS = "SPORTS"
    HEALTH = "HEALTH"
    WORLD = "WORLD"


class IntelligenceBiasLean(str, Enum):
    LEFT = "LEFT"
    CENTER_LEFT = "CENTER_LEFT"
    CENTER = "CENTER"
    CENTER_RIGHT = "CENTER_RIGHT"
    RIGHT = "RIGHT"


class EventIntelligenceResponse(BaseModel):
    """Structured response schema from LLM event clustering enrichment."""
    summary: str = Field(..., description="Objective synthesis of the event. Must be minimum 3 paragraphs.")
    topic: IntelligenceTopic = Field(..., description="High-level news topic category.")
    bias_lean: IntelligenceBiasLean = Field(..., description="Overall bias lean of the aggregated articles.")
    location_country: str = Field(..., description="Primary geographic country focus of the event.")
    latitude: float = Field(..., description="Approximate geographic center latitude of the event.")
    longitude: float = Field(..., description="Approximate geographic center longitude of the event.")
    importance_score: float = Field(..., ge=0.0, le=10.0, description="Scale of importance from 0.0 (trivial) to 10.0 (major global event).")

    @field_validator("summary")
    @classmethod
    def validate_paragraphs(cls, v: str) -> str:
        """Enforce that the summary contains at least 3 paragraphs."""
        # Normalize carriage returns and split on double newlines
        paragraphs = [p.strip() for p in v.replace("\r\n", "\n").split("\n\n") if p.strip()]
        if len(paragraphs) < 3:
            # Fall back to single newlines in case the LLM returned it that way
            paragraphs = [p.strip() for p in v.replace("\r\n", "\n").split("\n") if p.strip()]
            if len(paragraphs) < 3:
                raise ValueError("Summary must contain at least 3 paragraphs")
        return v
