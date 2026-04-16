"""
users/service.py
----------------
Business logic layer for the users domain.

Rules:
- Calls repository for all DB access.
- Calls core/security.py for crypto.
- Raises HTTPException with meaningful status codes.
- No SQLAlchemy queries directly — always goes through repository.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import security
from app.models.user import User
from app.users import repository
from app.users.schemas import UserCreate, UserUpdate


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def register_user(db: Session, user_in: UserCreate) -> User:
    """
    Create a new user account.

    Raises:
        400 Bad Request — if email is already registered.
    """
    existing = repository.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )
    hashed = security.hash_password(user_in.password)
    return repository.create_user(db, user_in.email, hashed, user_in.role)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def authenticate_user(db: Session, email: str, password: str) -> User:
    """
    Verify credentials and return the user.

    Raises:
        401 Unauthorized — if email not found or password is wrong.
    """
    user = repository.get_user_by_email(db, email)
    if user is None or not security.verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact an administrator.",
        )
    return user


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_user_by_id(db: Session, user_id: int) -> User:
    """
    Fetch a single user by ID.

    Raises:
        404 Not Found — if no user matches user_id.
    """
    user = repository.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id={user_id} not found.",
        )
    return user


def get_all_users(db: Session) -> list[User]:
    """Return all users (admin-only access enforced by API layer)."""
    return repository.get_all_users(db)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def update_user(db: Session, user_id: int, user_in: UserUpdate) -> User:
    """
    Update an existing user.

    Raises:
        404 Not Found — if no user matches user_id.
        400 Bad Request — if the new email is already taken by another user.
    """
    # Ensure user exists
    target = repository.get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id={user_id} not found.",
        )

    # Guard email uniqueness
    if user_in.email and user_in.email != target.email:
        taken = repository.get_user_by_email(db, user_in.email)
        if taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use by another account.",
            )

    update_data = user_in.model_dump(exclude_unset=True)
    updated = repository.update_user(db, user_id, update_data)
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def delete_user(db: Session, user_id: int) -> None:
    """
    Delete a user account.

    Raises:
        404 Not Found — if no user matches user_id.
    """
    deleted = repository.delete_user(db, user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id={user_id} not found.",
        )
