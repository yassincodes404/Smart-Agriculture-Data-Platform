"""
users/schemas.py
----------------
Pydantic request/response contracts for the users domain.

Rules:
- Requests are validated on input.
- Responses never expose password_hash.
- All schemas are strict (extra fields forbidden).
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator


# ---------------------------------------------------------------------------
# Allowed roles
# ---------------------------------------------------------------------------
VALID_ROLES = {"admin", "analyst", "viewer"}


# ---------------------------------------------------------------------------
# Request schemas (incoming data FROM client)
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    """Body for POST /auth/register"""

    email: EmailStr
    password: str
    role: Literal["admin", "analyst", "viewer"] = "viewer"

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

    model_config = {"extra": "forbid"}


class UserLogin(BaseModel):
    """Body for POST /auth/login"""

    email: EmailStr
    password: str

    model_config = {"extra": "forbid"}


class UserUpdate(BaseModel):
    """Body for PUT /users/{id} — all fields optional."""

    email: Optional[EmailStr] = None
    role: Optional[Literal["admin", "analyst", "viewer"]] = None
    is_active: Optional[bool] = None

    model_config = {"extra": "forbid"}


# ---------------------------------------------------------------------------
# Response schemas (data sent TO client)
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    """Safe user representation — never includes password_hash."""

    user_id: int
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Returned after successful login."""

    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Standard API envelope
# ---------------------------------------------------------------------------

class APIResponse(BaseModel):
    """Wrapper for all API responses — matches the doc standard."""

    status: str
    data: object = None
    message: str = ""
    meta: dict = {}
