"""
GlobeLens AI — ArticleRepository
Async SQLAlchemy repository for Article entity persistence and retrieval.
"""
import uuid
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.entities.models import Article, ProcessingStatus


class ArticleRepository:
    """
    Data access layer for the Article entity.
    All methods accept an AsyncSession injected by FastAPI dependency injection.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, article: Article) -> Article:
        """Insert or update an Article record."""
        self._session.add(article)
        await self._session.commit()
        await self._session.refresh(article)
        return article

    async def find_by_id(self, article_id: uuid.UUID) -> Optional[Article]:
        """Fetch a single article by primary key."""
        return await self._session.get(Article, article_id)

    async def find_unprocessed(self, status: ProcessingStatus) -> List[Article]:
        """Return all articles at a given processing stage for pipeline workers."""
        result = await self._session.execute(
            select(Article).where(Article.processing_status == status)
        )
        return list(result.scalars().all())

    async def find_by_event(self, event_id: uuid.UUID) -> List[Article]:
        """Return all articles belonging to a given Event."""
        result = await self._session.execute(
            select(Article).where(Article.event_id == event_id)
        )
        return list(result.scalars().all())

    async def update_status(
        self, article_id: uuid.UUID, status: ProcessingStatus
    ) -> None:
        """Efficiently update only the processing_status column."""
        await self._session.execute(
            update(Article)
            .where(Article.id == article_id)
            .values(processing_status=status)
        )
        await self._session.commit()
