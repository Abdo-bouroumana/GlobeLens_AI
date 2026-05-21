"""
GlobeLens AI — AdminController (ADMIN role required for all endpoints)
GET  /admin/dashboard | /admin/users | /admin/stats
PUT  /admin/users/{id}/role | /admin/users/{id}/block | /admin/articles/{id}/hide
DELETE /admin/users/{id} | /admin/comments/{id}
POST /admin/events/promote | /admin/sources
"""
from fastapi import APIRouter, Path, status
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class UpdateRoleRequest(BaseModel):
    role: str  # GUEST | AUTH_USER | JOURNALIST | ADMIN


class CreateSourceRequest(BaseModel):
    name: str
    url: str
    country: Optional[str] = None
    credibility_score: Optional[float] = 0.5


class PromoteEventRequest(BaseModel):
    event_id: str


@router.get("/dashboard", summary="Admin dashboard overview (ADMIN)")
async def get_dashboard():
    # TODO: IAdminService.getDashboardStats()
    return {"total_users": 0, "total_events": 0, "total_articles": 0}


@router.get("/users", summary="List all users (ADMIN)")
async def list_users():
    # TODO: IUserRepository.findAll()
    return {"users": []}


@router.put("/users/{user_id}/role", summary="Change user role (ADMIN)")
async def update_user_role(user_id: str = Path(...), payload: UpdateRoleRequest = ...):
    # TODO: IUserService.updateRole(user_id, role)
    return {"message": f"Role updated to {payload.role}", "user_id": user_id}


@router.put("/users/{user_id}/block", summary="Block / unblock a user (ADMIN)")
async def toggle_block_user(user_id: str = Path(...)):
    # TODO: IUserService.blockUser(user_id)
    return {"message": "User block status toggled", "user_id": user_id}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete user (ADMIN)")
async def admin_delete_user(user_id: str = Path(...)):
    # TODO: IUserService.deleteUser(user_id)
    return None


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Moderate / delete comment (ADMIN)")
async def admin_delete_comment(comment_id: str = Path(...)):
    # TODO: ICommentService.deleteComment(comment_id, force=True)
    return None


@router.post("/events/promote", status_code=status.HTTP_200_OK, summary="Promote an event to featured (ADMIN)")
async def promote_event(payload: PromoteEventRequest):
    # TODO: IEventService.promoteEvent(event_id)
    return {"message": "Event promoted", "event_id": payload.event_id}


@router.put("/articles/{article_id}/hide", summary="Hide / mask article from public (ADMIN)")
async def hide_article(article_id: str = Path(...)):
    # TODO: IArticleService.hideArticle(article_id)
    return {"message": "Article hidden", "article_id": article_id}


@router.post("/sources", status_code=status.HTTP_201_CREATED, summary="Add a new media source (ADMIN)")
async def create_source(payload: CreateSourceRequest):
    # TODO: ISourceRepository.save(payload)
    return {"message": "Source added", "name": payload.name}


@router.get("/stats", summary="System-wide analytics (ADMIN)")
async def get_stats():
    # TODO: IAdminService.getSystemStats()
    return {"articles_today": 0, "events_today": 0, "active_users": 0}
