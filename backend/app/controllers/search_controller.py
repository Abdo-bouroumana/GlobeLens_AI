"""
GlobeLens AI — SearchController
================================
Exposes search and autocomplete endpoints queryable via Elasticsearch.
"""
from fastapi import APIRouter, Query
from typing import List, Dict, Any

from app.repositories.search_repository import SearchRepository

router = APIRouter()
search_repo = SearchRepository()


@router.get("/query", summary="Full-text search across events (Elasticsearch)")
async def search(
    q: str = Query(..., min_length=1, description="Search query string"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results to return")
) -> List[Dict[str, Any]]:
    """
    Performs a multi-match query across event titles and summaries.
    Returns a JSON list of matches.
    """
    return await search_repo.search(q, size=limit)


@router.get("/autocomplete", summary="Autocomplete query suggestions")
async def autocomplete(
    prefix: str = Query(..., min_length=1, description="Prefix to autocomplete"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of suggestions to return")
) -> List[Dict[str, Any]]:
    """
    Performs a search on title.autocomplete using the edge_ngram analyzer.
    Returns a JSON list of matching suggestions.
    """
    return await search_repo.autocomplete(prefix, size=limit)

