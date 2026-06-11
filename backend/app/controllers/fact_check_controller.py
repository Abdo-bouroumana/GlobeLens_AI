"""
GlobeLens AI — FactCheckController
===================================
POST /fact-check | GET /fact-check/{id} | GET /fact-check/users/{id}
"""
import json
import uuid
from fastapi import APIRouter, Path, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.controllers.auth_controller import get_current_user
from app.entities.models import User, FactCheckRequest as FactCheckModel, FactCheckResult

router = APIRouter()


class FactCheckRequest(BaseModel):
    input_text_url: str


@router.post("", status_code=status.HTTP_201_CREATED, summary="Submit text/URL for AI fact-checking")
async def submit_fact_check(
    payload: FactCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services.scraper_service import ScraperService
    from app.services.llm_service import LLMService
    
    input_text = payload.input_text_url.strip()
    scraped_content = ""
    
    # 1. If it's a URL, extract its main body text
    if input_text.startswith("http://") or input_text.startswith("https://"):
        try:
            scraper = ScraperService()
            scraped_content = await scraper.extract_full_content(input_text)
        except Exception:
            # Fallback to direct URL prompt evaluation if scraping fails
            pass
            
    # Fallback to direct input if scraping returned no text
    text_to_analyze = scraped_content if scraped_content and len(scraped_content.strip()) > 30 else input_text
    
    # 2. Call LLM to evaluate claim credibility
    llm_service = LLMService()
    analysis = await llm_service.analyze_claim_credibility(text_to_analyze)
    
    # 3. Map credibility score to standard status enum
    score = analysis.credibility_score
    if score >= 70:
        result_enum = FactCheckResult.TRUE
    elif score <= 40:
        result_enum = FactCheckResult.FALSE
    else:
        result_enum = FactCheckResult.UNCERTAIN

    explanation_dict = {
        "credibility_score": score,
        "trust_risks": analysis.trust_risks,
        "independent_cross_references": analysis.independent_cross_references,
        "claims": [{"text": c.text, "status": c.status} for c in analysis.claims],
        "historical_matches": [
            {
                "title": hm.title,
                "last_active": hm.last_active,
                "match_percentage": hm.match_percentage
            } for hm in analysis.historical_matches
        ],
        "summary": analysis.summary
    }
    
    # 4. Save in database
    new_request = FactCheckModel(
        input_text_url=input_text,
        result=result_enum,
        explanation=json.dumps(explanation_dict),
        user_id=current_user.id
    )
    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)
    
    return {
        "id": str(new_request.id),
        "status": "completed",
        "input": input_text,
        "result": result_enum.value,
        "explanation": explanation_dict,
        "created_at": new_request.created_at.isoformat() if new_request.created_at else None
    }


@router.get("/{request_id}", summary="Get fact-check result by ID")
async def get_fact_check(
    request_id: str = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        req_uuid = uuid.UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request UUID format")

    query = select(FactCheckModel).where(FactCheckModel.id == req_uuid)
    res = await db.execute(query)
    req = res.scalars().first()
    
    if not req:
        raise HTTPException(status_code=404, detail="Fact check request not found")
        
    # Safeguard user separation (unless admin)
    if current_user.role != "ADMIN" and current_user.id != req.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    explanation_data = {}
    if req.explanation:
        try:
            explanation_data = json.loads(req.explanation)
        except Exception:
            explanation_data = {"raw": req.explanation}
            
    return {
        "id": str(req.id),
        "input": req.input_text_url,
        "result": req.result.value if req.result else None,
        "explanation": explanation_data,
        "created_at": req.created_at.isoformat() if req.created_at else None
    }


@router.get("/users/{user_id}", summary="Get all fact-check requests by user")
async def get_user_fact_checks(
    user_id: str = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user UUID format")

    # Safeguard user separation (unless admin)
    if current_user.role != "ADMIN" and current_user.id != target_uuid:
        raise HTTPException(status_code=403, detail="Access denied")
        
    query = (
        select(FactCheckModel)
        .where(FactCheckModel.user_id == target_uuid)
        .order_by(FactCheckModel.created_at.desc())
    )
    res = await db.execute(query)
    requests = res.scalars().all()
    
    response_list = []
    for req in requests:
        explanation_data = {}
        if req.explanation:
            try:
                explanation_data = json.loads(req.explanation)
            except Exception:
                explanation_data = {"raw": req.explanation}
                
        response_list.append({
            "id": str(req.id),
            "input": req.input_text_url,
            "result": req.result.value if req.result else None,
            "explanation": explanation_data,
            "created_at": req.created_at.isoformat() if req.created_at else None
        })
        
    return {"user_id": user_id, "requests": response_list}
