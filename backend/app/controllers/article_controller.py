"""
GlobeLens AI — ArticleController
GET  /articles/{id} | /events/{id}/articles | /articles/{id}/audio
POST /articles | PUT /articles/{id} | DELETE /articles/{id}
"""
from fastapi import APIRouter, Path, status
from pydantic import BaseModel
from typing import Optional

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
