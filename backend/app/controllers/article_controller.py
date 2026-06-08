"""
GlobeLens AI — ArticleController
GET  /articles/{id} | /events/{id}/articles | /articles/{id}/audio
POST /articles | PUT /articles/{id} | DELETE /articles/{id}
POST /articles/sync
"""
import uuid
from typing import Optional, List
from fastapi import APIRouter, Path, status, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.controllers.auth_controller import get_current_user
from app.entities.models import User, UserRole
from app.services.scraper_service import ScraperService

router = APIRouter()


class CreateArticleRequest(BaseModel):
    title: str
    content: str
    url: str
    source_id: Optional[str] = None


@router.get("/{article_id}", summary="Get article by ID")
async def get_article(article_id: str = Path(...)):
    # TODO: IArticleService.getById(article_id)
    return {"id": article_id, "title": "Placeholder Article"}


@router.post("", status_code=status.HTTP_201_CREATED, summary="Submit a new article (Journalist)")
async def create_article(payload: CreateArticleRequest):
    # TODO: IArticleService.createArticle(payload) — Journalist role required
    return {"message": "Article submitted", "url": payload.url}


@router.put("/{article_id}", summary="Update article content (Journalist/Admin)")
async def update_article(article_id: str = Path(...), payload: CreateArticleRequest = ...):
    # TODO: IArticleService.updateArticle(article_id, payload)
    return {"message": "Article updated", "id": article_id}


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete article")
async def delete_article(article_id: str = Path(...)):
    # TODO: IArticleService.deleteArticle(article_id) — Admin/Journalist
    return None


@router.get("/{article_id}/audio", summary="Get TTS audio stream for article")
async def get_article_audio(article_id: str = Path(...)):
    # TODO: IAudioService.textToSpeech(article_id)
    return {"message": "Audio generation placeholder", "article_id": article_id}


@router.post("/sync", status_code=status.HTTP_202_ACCEPTED, summary="Trigger RSS & Playwright scraping sync pipeline (Admin/Journalist)")
async def sync_articles(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Trigger the asynchronous data ingestion pipeline.
    Authorized for Admin and Journalist roles only.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.JOURNALIST):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only journalists and administrators can sync articles"
        )
        
    scraper_service = ScraperService()
    background_tasks.add_task(scraper_service.run_pipeline)
    return {"status": "sync_initiated"}
