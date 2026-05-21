"""
GlobeLens AI — SearchRepository
Elasticsearch client wrapper for event indexing and full-text search.
"""
from typing import Any, Dict, List

from elasticsearch import AsyncElasticsearch

from app.core.config import settings


class SearchRepository:
    """
    Elasticsearch data access layer for the SearchService.
    Handles event document indexing and full-text search queries.
    """

    INDEX = settings.ELASTICSEARCH_INDEX_EVENTS

    def __init__(self) -> None:
        self._client = AsyncElasticsearch(hosts=[settings.ELASTICSEARCH_URL])

    async def index(self, event_id: str, document: Dict[str, Any]) -> None:
        """Index or update an Event document in Elasticsearch."""
        await self._client.index(
            index=self.INDEX,
            id=event_id,
            document=document,
        )

    async def search(self, query: str, size: int = 20) -> List[Dict[str, Any]]:
        """
        Execute a multi-match full-text search across title, summary, topic.
        Returns a list of matching event documents.
        """
        response = await self._client.search(
            index=self.INDEX,
            body={
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": ["title^3", "summary^2", "topic", "country"],
                        "fuzziness": "AUTO",
                    }
                },
                "size": size,
            },
        )
        return [hit["_source"] for hit in response["hits"]["hits"]]

    async def get_suggestions(self, prefix: str) -> List[str]:
        """Autocomplete suggestions using Elasticsearch suggest API."""
        response = await self._client.search(
            index=self.INDEX,
            body={
                "suggest": {
                    "title_suggest": {
                        "prefix": prefix,
                        "completion": {"field": "title.suggest"},
                    }
                }
            },
        )
        options = response.get("suggest", {}).get("title_suggest", [{}])
        return [opt["text"] for opt in options[0].get("options", [])]

    async def close(self) -> None:
        await self._client.close()
