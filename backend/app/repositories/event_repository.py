"""
GlobeLens AI — EventRepository
Async SQLAlchemy repository for Event entity — the core aggregation unit.
"""
import uuid
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.entities.models import Event


class EventRepository:
    """Data access layer for Event aggregation entities."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, event: Event) -> Event:
        self._session.add(event)
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def find_by_id(self, event_id: uuid.UUID) -> Optional[Event]:
        return await self._session.get(Event, event_id)

    async def find_trending(self, limit: int = 20) -> List[Event]:
        """Return events ordered by importance_score descending."""
        result = await self._session.execute(
            select(Event)
            .order_by(desc(Event.importance_score))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def find_latest(self, limit: int = 20) -> List[Event]:
        """Return events ordered by creation date descending."""
        result = await self._session.execute(
            select(Event)
            .order_by(desc(Event.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def find_by_country(self, country: str) -> List[Event]:
        result = await self._session.execute(
            select(Event).where(Event.country == country)
        )
        return list(result.scalars().all())

    async def find_by_topic(self, topic: str) -> List[Event]:
        result = await self._session.execute(
            select(Event).where(Event.topic == topic)
        )
        return list(result.scalars().all())

    async def find_map_events(self) -> List[Event]:
        """Return events that have valid lat/lon coordinates for map view."""
        result = await self._session.execute(
            select(Event).where(
                Event.latitude.isnot(None),
                Event.longitude.isnot(None),
            )
        )
        return list(result.scalars().all())
