"""
GlobeLens AI — FactCheckController
POST /fact-check | GET /fact-check/{id} | GET /users/{id}/fact-checks
"""
from fastapi import APIRouter, Path
from pydantic import BaseModel

router = APIRouter()


class FactCheckRequest(BaseModel):
    input_text_url: str


@router.post("", status_code=201, summary="Submit text/URL for AI fact-checking")
async def submit_fact_check(payload: FactCheckRequest):
    # TODO: IFactCheckService.analyzeClaim(payload) → LLMService
    return {
        "id": "placeholder-uuid",
        "status": "processing",
        "input": payload.input_text_url,
    }


@router.get("/{request_id}", summary="Get fact-check result by ID")
async def get_fact_check(request_id: str = Path(...)):
    # TODO: IFactCheckService.getById(request_id)
    return {
        "id": request_id,
        "result": "UNCERTAIN",
        "explanation": "Fact-check in progress...",
    }


@router.get("/users/{user_id}", summary="Get all fact-check requests by user")
async def get_user_fact_checks(user_id: str = Path(...)):
    # TODO: IFactCheckRepository.findByUser(user_id)
    return {"user_id": user_id, "requests": []}
