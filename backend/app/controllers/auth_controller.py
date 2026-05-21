"""
GlobeLens AI — AuthController
POST /auth/register | /auth/login | /auth/logout | /auth/refresh
GET  /auth/me
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.entities.models import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse
)
from app.services.auth_service import AuthService

router = APIRouter()
security = HTTPBearer()


# ── Dependency for fetching current authenticated user ─────────────────────────
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to validate access token and return current active user.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_repo = UserRepository(db)
    user = await user_repo.find_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been blocked"
        )
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user"
)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new user.
    Hashes password, saves to DB, returns user info (excl. password_hash).
    """
    user_repo = UserRepository(db)
    auth_service = AuthService(user_repo)
    user = await auth_service.register_user(payload)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain JWT"
)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user, returning a signed HS256 JWT containing sub, email, and role.
    """
    user_repo = UserRepository(db)
    auth_service = AuthService(user_repo)
    user = await auth_service.authenticate_user(payload)

    # Issue access token
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    }
    access_token = auth_service.create_access_token(token_data)
    return TokenResponse(access_token=access_token)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get currently authenticated user"
)
async def me(current_user: User = Depends(get_current_user)):
    """
    Get profile details of the currently authenticated user.
    """
    return current_user


@router.post("/logout", summary="Invalidate session / blacklist token")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Placeholder logout endpoint.
    Token blacklisting can be handled in a later phase with Redis cache integration.
    """
    return {"message": "Logged out successfully"}


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Issue new access token using refresh token"
)
async def refresh_token():
    """
    Placeholder refresh token endpoint.
    """
    return TokenResponse(access_token="new_placeholder_jwt_token")

