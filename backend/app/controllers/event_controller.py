"""
GlobeLens AI — EventController
GET  /events | /events/{id} | /events/trending | /events/latest
GET  /events/country/{country} | /events/topic/{topic} | /events/map
POST /events/{id}/follow
"""
from fastapi import APIRouter, Path, Query, Depends
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()


@router.get("", summary="List all events (paginated)")
async def list_events(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    from app.entities.models import Event
    
    offset = (page - 1) * limit
    
    # Total count of PROCESSED events
    total_query = select(func.count(Event.id)).where(Event.status == "PROCESSED")
    total_count = await db.scalar(total_query) or 0
    
    # Paginated PROCESSED events
    events_query = (
        select(Event)
        .where(Event.status == "PROCESSED")
        .options(selectinload(Event.articles))
        .order_by(Event.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(events_query)
    events = result.scalars().all()
    
    event_list = []
    for evt in events:
        event_list.append({
            "id": str(evt.id),
            "title": evt.title,
            "summary": evt.summary or "",
            "topic": evt.topic or "WORLD",
            "country": evt.country or "Unknown",
            "latitude": evt.latitude,
            "longitude": evt.longitude,
            "importance_score": evt.importance_score,
            "source_count": len(evt.articles),
            "bias_lean": evt.bias_lean.name if evt.bias_lean else "CENTER"
        })
        
    return {
        "events": event_list,
        "page": page,
        "limit": limit,
        "total": total_count
    }


@router.get("/trending", summary="Get trending events by importance score")
async def get_trending():
    # TODO: IEventService.getTrending()
    return {"events": []}


@router.get("/latest", summary="Get latest events ordered by creation date")
async def get_latest():
    # TODO: IEventService.getLatest()
    return {"events": []}


@router.get("/map", summary="Get events with geolocation data for map view")
async def get_map_events(db: AsyncSession = Depends(get_db)):
    """Returns lat/lon + metadata for the map interface."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.entities.models import Event
    
    result = await db.execute(
        select(Event)
        .where(
            Event.status == "PROCESSED",
            Event.latitude.isnot(None),
            Event.longitude.isnot(None)
        )
        .options(selectinload(Event.articles))
    )
    events = result.scalars().all()
    
    event_list = []
    for evt in events:
        event_list.append({
            "id": str(evt.id),
            "title": evt.title,
            "summary": evt.summary or "",
            "topic": evt.topic or "WORLD",
            "country": evt.country or "Unknown",
            "latitude": evt.latitude,
            "longitude": evt.longitude,
            "importance_score": evt.importance_score,
            "source_count": len(evt.articles),
            "bias_lean": evt.bias_lean.name if evt.bias_lean else "CENTER"
        })
        
    return {"events": event_list}


@router.get("/country/{country}", summary="Filter events by country")
async def get_events_by_country(country: str = Path(..., description="ISO country name")):
    # TODO: IEventService.getByCountry(country)
    return {"country": country, "events": []}


@router.get("/topic/{topic}", summary="Filter events by topic")
async def get_events_by_topic(topic: str = Path(...)):
    # TODO: IEventService.getByTopic(topic)
    return {"topic": topic, "events": []}


@router.get("/{event_id}", summary="Get a single event by ID")
async def get_event(
    event_id: str = Path(..., description="Event UUID"),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.entities.models import Event, Article
    from fastapi import HTTPException
    import uuid
    
    try:
        event_uuid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event UUID format")
        
    query = (
        select(Event)
        .where(Event.id == event_uuid)
        .options(selectinload(Event.articles).selectinload(Article.source))
    )
    result = await db.execute(query)
    evt = result.scalars().first()
    
    if not evt:
        raise HTTPException(status_code=404, detail="Event not found")
        
    articles_list = []
    for art in evt.articles:
        articles_list.append({
            "id": str(art.id),
            "title": art.title,
            "content": art.content or "",
            "url": art.url,
            "published_at": art.published_at.isoformat() if art.published_at else None,
            "source": {
                "name": art.source.name if art.source else "Unknown",
                "credibility_score": art.source.credibility_score if art.source else 0.5
            }
        })
        
    return {
        "id": str(evt.id),
        "title": evt.title,
        "summary": evt.summary or "",
        "topic": evt.topic or "WORLD",
        "country": evt.country or "Unknown",
        "latitude": evt.latitude,
        "longitude": evt.longitude,
        "importance_score": evt.importance_score,
        "bias_lean": evt.bias_lean.name if evt.bias_lean else "CENTER",
        "status": evt.status,
        "created_at": evt.created_at.isoformat() if evt.created_at else None,
        "articles": articles_list
    }



@router.post("/{event_id}/follow", status_code=201, summary="Follow / subscribe to an event")
async def follow_event(event_id: str = Path(...)):
    # TODO: INotificationService.subscribeToEvent(user_id, event_id)
    return {"message": f"Following event {event_id}"}
