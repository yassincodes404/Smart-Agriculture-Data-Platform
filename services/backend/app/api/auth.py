"""
api/auth.py
-----------
Authentication endpoints.

Routes (all prefixed /api/v1 from main.py):
    POST  /auth/register  → create a new user account
    POST  /auth/login     → authenticate and receive a JWT token
    GET   /auth/me        → get the currently authenticated user (protected)
    POST  /auth/logout    → client-side logout notice (stateless JWT)

Design rule: this file stays thin — no business logic, no DB queries.
All logic lives in users/service.py.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core import security
from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.users import service as user_service
from app.users.schemas import (
    APIResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=APIResponse,
    summary="Register a new user account",
)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user.

    - **email**: must be unique
    - **password**: minimum 8 characters
    - **role**: admin | analyst | viewer (default: viewer)
    """
    user = user_service.register_user(db, user_in)
    return APIResponse(
        status="success",
        data=UserResponse.model_validate(user).model_dump(),
        message="User registered successfully.",
    )


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=APIResponse,
    summary="Login and receive a JWT access token",
)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate with email + password.

    Returns a **Bearer JWT token** to be sent in the `Authorization` header
    for all protected endpoints.
    """
    user = user_service.authenticate_user(db, credentials.email, credentials.password)
    token = security.create_access_token(data={"sub": str(user.user_id)})
    return APIResponse(
        status="success",
        data=TokenResponse(access_token=token).model_dump(),
        message="Login successful.",
    )


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=APIResponse,
    summary="Get the currently authenticated user",
)
def me(current_user: User = Depends(get_current_user)):
    """
    Returns the profile of the user identified by the JWT token in the
    `Authorization: Bearer <token>` header.
    """
    return APIResponse(
        status="success",
        data=UserResponse.model_validate(current_user).model_dump(),
    )


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

@router.post(
    "/logout",
    response_model=APIResponse,
    summary="Logout (client-side token invalidation)",
)
def logout(current_user: User = Depends(get_current_user)):
    """
    Stateless logout — the server acknowledges the request but does not
    maintain a token blacklist. The client is responsible for discarding the
    JWT token after this call.
    """
    return APIResponse(
        status="success",
        message=f"User {current_user.email} logged out. Discard your token.",
    )
