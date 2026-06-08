"""
GlobeLens AI — LLMService
===========================
Integrates Grok (x.AI) / OpenAI to generate syntheses, extract locations, topics, bias and importance.
Pipeline Step 4: CLUSTERED → PROCESSED
"""
import uuid
import structlog
from typing import List, Tuple, TypedDict
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.database import AsyncSessionFactory
from app.repositories.article_repository import ArticleRepository
from app.repositories.event_repository import EventRepository
from app.schemas.intelligence import EventIntelligenceResponse

logger = structlog.get_logger()


class GeminiEventIntelligenceResponse(TypedDict):
    summary: str
    topic: str
    bias_lean: str
    location_country: str
    latitude: float
    longitude: float
    importance_score: float


class LLMService:
    """
    Facade over LLM providers (x.AI Grok / OpenAI GPT).
    Selects the active provider from settings.LLM_PROVIDER.
    """

    def __init__(self) -> None:
        # Configure client dynamically
        if settings.LLM_PROVIDER == "gemini":
            logger.info("Initializing LLMService client with Gemini config")
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._client = genai
            except ImportError:
                logger.warn("google-generativeai package not installed, client initialization deferred")
                self._client = None
            self._model = "gemini-1.5-flash"
        elif settings.LLM_PROVIDER == "grok":
            logger.info("Initializing LLMService client with Grok (x.AI) config")
            self._client = AsyncOpenAI(
                api_key=settings.GROK_API_KEY,
                base_url="https://api.x.ai/v1"
            )
            self._model = "grok-beta"
        else:
            logger.info("Initializing LLMService client with OpenAI config")
            self._client = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY
            )
            # Default to a robust, fast OpenAI model
            self._model = "gpt-4o-mini"

    async def analyze_event_cluster(self, articles_content: List[str]) -> EventIntelligenceResponse:
        """
        Synthesize articles content into a structured event intelligence schema.
        Instructs the LLM to act as an objective, cross-border investigative journalist.
        """
        system_prompt = (
            "You are an objective, cross-border investigative journalist. "
            "Your task is to analyze a cluster of news articles about a single event and synthesize them. "
            "You must return a JSON object that strictly adheres to the following JSON Schema. "
            "Ensure the summary is detailed and contains a minimum of 3 paragraphs.\n\n"
            "Required JSON Schema:\n"
            "{\n"
            "  \"summary\": \"string (Objective synthesis, minimum 3 paragraphs)\",\n"
            "  \"topic\": \"string (Exactly one of: POLITICS, ECONOMY, TECHNOLOGY, SPORTS, HEALTH, WORLD)\",\n"
            "  \"bias_lean\": \"string (Exactly one of: LEFT, CENTER_LEFT, CENTER, CENTER_RIGHT, RIGHT)\",\n"
            "  \"location_country\": \"string (Primary geographic focus country)\",\n"
            "  \"latitude\": \"float (Approximate latitude)\",\n"
            "  \"longitude\": \"float (Approximate longitude)\",\n"
            "  \"importance_score\": \"float (From 0.0 to 10.0 representing significance)\"\n"
            "}"
        )

        concatenated_articles = "\n\n=== ARTICLE ===\n".join(articles_content)
        user_prompt = f"Analyze the following articles belonging to the same event cluster and generate the intelligence report:\n\n=== ARTICLE ===\n{concatenated_articles}"

        logger.info(
            "Calling Chat Completions API for event synthesis",
            provider=settings.LLM_PROVIDER,
            model=self._model,
            num_articles=len(articles_content)
        )

        try:
            if settings.LLM_PROVIDER == "gemini":
                if not self._client:
                    import google.generativeai as genai
                    genai.configure(api_key=settings.GEMINI_API_KEY)
                    self._client = genai
                
                try:
                    model = self._client.GenerativeModel(
                        model_name=self._model,
                        system_instruction=system_prompt
                    )
                    
                    generation_config = {
                        "response_mime_type": "application/json",
                        "response_schema": GeminiEventIntelligenceResponse,
                        "temperature": 0.1
                    }
                    
                    response = await model.generate_content_async(
                        user_prompt,
                        generation_config=generation_config
                    )
                    raw_content = response.text
                except Exception as model_err:
                    if "not found" in str(model_err).lower() or "404" in str(model_err):
                        logger.warn("Gemini LLM model not found, trying fallbacks", model=self._model, error=str(model_err))
                        fallback_llms = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"]
                        response = None
                        for fallback in fallback_llms:
                            try:
                                model = self._client.GenerativeModel(
                                    model_name=fallback,
                                    system_instruction=system_prompt
                                )
                                generation_config = {
                                    "response_mime_type": "application/json",
                                    "response_schema": GeminiEventIntelligenceResponse,
                                    "temperature": 0.1
                                }
                                response = await model.generate_content_async(
                                    user_prompt,
                                    generation_config=generation_config
                                )
                                raw_content = response.text
                                self._model = fallback
                                logger.info("Successfully fell back to LLM model", model=fallback)
                                break
                            except Exception as fb_err:
                                logger.warn("Fallback LLM failed", model=fallback, error=str(fb_err))
                                continue
                        if not response:
                            raise model_err
                    else:
                        raise model_err
            else:
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                raw_content = response.choices[0].message.content
                usage = response.usage
                if usage:
                    logger.info(
                        "LLM token usage",
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens,
                        total_tokens=usage.total_tokens
                    )
            
            # Parse and validate using our Pydantic schema
            validated_response = EventIntelligenceResponse.model_validate_json(raw_content)
            return validated_response
        except Exception as err:
            logger.error("LLM event analysis failed", error=str(err))
            raise err

    async def process_pending_events(self) -> Tuple[int, int]:
        """
        Fetches unprocessed events, pulls their associated articles, calls analyze_event_cluster,
        and commits the intelligence data via EventRepository.
        """
        logger.info("Starting processing of pending events")
        processed_count = 0
        error_count = 0

        async with AsyncSessionFactory() as session:
            event_repo = EventRepository(session)
            article_repo = ArticleRepository(session)

            try:
                events = await event_repo.get_unprocessed_events(limit=20)
                logger.info("Fetched unprocessed events for LLM synthesis", count=len(events))

                for event in events:
                    try:
                        # Pull associated articles
                        articles = await article_repo.find_by_event(event.id)
                        if not articles:
                            logger.warn("Event has no associated articles, skipping", event_id=str(event.id))
                            continue
                        
                        # Extract contents
                        articles_content = []
                        for art in articles:
                            if art.content and art.content.strip():
                                articles_content.append(f"Title: {art.title}\nContent: {art.content}")

                        if not articles_content:
                            logger.warn("Articles content empty for event, skipping", event_id=str(event.id))
                            continue
                        
                        # Call LLM Service to analyze cluster
                        intelligence = await self.analyze_event_cluster(articles_content)
                        
                        # Update event intelligence in repository
                        intel_data = {
                            "summary": intelligence.summary,
                            "topic": intelligence.topic.value,
                            "bias_lean": intelligence.bias_lean.value,
                            "location_country": intelligence.location_country,
                            "latitude": intelligence.latitude,
                            "longitude": intelligence.longitude,
                            "importance_score": intelligence.importance_score
                        }
                        
                        await event_repo.update_event_intelligence(event.id, intel_data)
                        logger.info("Event intelligence successfully updated", event_id=str(event.id))
                        
                        # Trigger real-time search indexing
                        try:
                            from app.services.search_service import SearchService
                            search_service = SearchService()
                            event_data = {
                                "title": event.title,
                                "summary": intel_data["summary"],
                                "topic": intel_data["topic"],
                                "location_country": intel_data["location_country"],
                                "importance_score": intel_data["importance_score"]
                            }
                            await search_service.index_processed_event(event.id, event_data)
                        except Exception as search_err:
                            logger.error(
                                "Failed to index event in Elasticsearch during real-time sync",
                                event_id=str(event.id),
                                error=str(search_err)
                            )
                        
                        processed_count += 1
                    except Exception as event_err:
                        logger.error(
                            "Failed to process event intelligence for event",
                            event_id=str(event.id),
                            error=str(event_err)
                        )
                        error_count += 1
                        continue
            except Exception as batch_err:
                logger.error("Pending events process batch encountered a fatal error", error=str(batch_err))
                await session.rollback()

        logger.info(
            "Finished processing pending events",
            processed=processed_count,
            failed=error_count
        )
        return processed_count, error_count
