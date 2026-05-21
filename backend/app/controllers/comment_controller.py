"""
GlobeLens AI — CommentController
POST /events/{id}/comments | GET /events/{id}/comments
PUT  /comments/{id}         | DELETE /comments/{id}
"""
from fastapi import APIRouter, Path, status
from pydantic import BaseModel

router = APIRouter()


class CreateCommentRequest(BaseModel):
    content: str


@router.post("/events/{event_id}/comments", status_code=status.HTTP_201_CREATED, summary="Post a comment on an event")
async def create_comment(event_id: str = Path(...), payload: CreateCommentRequest = ...):
    # TODO: ICommentService.createComment(event_id, user_id, payload)
    return {"message": "Comment posted", "event_id": event_id}


@router.get("/events/{event_id}/comments", summary="Get all comments for an event")
async def get_event_comments(event_id: str = Path(...)):
    # TODO: ICommentService.getCommentsByEvent(event_id)
    return {"event_id": event_id, "comments": []}


@router.put("/{comment_id}", summary="Edit a comment (author only)")
async def update_comment(comment_id: str = Path(...), payload: CreateCommentRequest = ...):
    # TODO: ICommentService.updateComment(comment_id, user_id, payload)
    return {"message": "Comment updated", "id": comment_id}


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a comment")
async def delete_comment(comment_id: str = Path(...)):
    # TODO: ICommentService.deleteComment(comment_id, user_id)
    return None
