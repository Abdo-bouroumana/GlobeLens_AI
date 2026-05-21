"""
GlobeLens AI — SearchController
GET /search?q= | GET /search/suggestions?q=
"""
from fastapi import APIRouter, Query

router = APIRouter()


@router.get("", summary="Full-text search across events (Elasticsearch)")
async def search(q: str = Query(..., min_length=1, description="Search query string")):
    # TODO: ISearchService.searchEvents(q) → Elasticsearch query
    return {"query": q, "results": [], "total": 0}


@router.get("/suggestions", summary="Autocomplete query suggestions")
async def get_suggestions(q: str = Query(..., min_length=1)):
    # TODO: ISearchService.getSuggestions(q) → Elasticsearch suggest
    return {"query": q, "suggestions": []}
