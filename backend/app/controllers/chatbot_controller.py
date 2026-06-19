"""
GlobeLens AI — ChatbotController
================================
POST /chatbot
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.controllers.auth_controller import get_current_user
from app.entities.models import User
from app.services.llm_service import LLMService

router = APIRouter()

class ChatbotRequest(BaseModel):
    message: str

class ChatbotResponse(BaseModel):
    reply: str
    source: str
    in_database: bool

@router.post("", response_model=ChatbotResponse, summary="Query AI News-Scout assistant")
async def chat_query(
    payload: ChatbotRequest,
    current_user: User = Depends(get_current_user)
):
    query_str = payload.message.strip()
    if not query_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty."
        )

    llm = LLMService()
    reply, source, in_database = await llm.answer_chatbot_question(query_str)
    
    return ChatbotResponse(
        reply=reply,
        source=source,
        in_database=in_database
    )
