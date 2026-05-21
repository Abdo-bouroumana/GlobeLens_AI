"""
GlobeLens AI — UserController
GET /users/{id} | PUT /users/{id} | DELETE /users/{id}
"""
from fastapi import APIRouter, Path
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    preferred_topics: Optional[List[str]] = None
    preferred_countries: Optional[List[str]] = None


@router.get("/{user_id}", summary="Get user profile by ID")
async def get_user(user_id: str = Path(...)):
    # TODO: IUserService.getUserById(user_id)
    return {"id": user_id, "name": "Placeholder User"}


@router.put("/{user_id}", summary="Update user profile and preferences")
async def update_user(user_id: str = Path(...), payload: UpdateUserRequest = ...):
    # TODO: IUserService.updateUser(user_id, payload)
    return {"message": "User updated", "id": user_id}


@router.delete("/{user_id}", status_code=204, summary="Delete user account")
async def delete_user(user_id: str = Path(...)):
    # TODO: IUserService.deleteUser(user_id)
    return None
