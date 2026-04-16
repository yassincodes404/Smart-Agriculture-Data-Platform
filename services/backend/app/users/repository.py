"""
users/repository.py
-------------------
Pure database queries for the users domain.

Rules (from architecture docs):
- NO business logic here — only SQLAlchemy queries.
- NO HTTP imports (no FastAPI, no status codes).
- Receives db session from caller (injected by dependencies.py).
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Return the User with the given email, or None if not found."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Return the User with the given ID, or None if not found."""
    return db.query(User).filter(User.user_id == user_id).first()


def get_all_users(db: Session) -> list[User]:
    """Return all users ordered by creation date (newest first)."""
    return db.query(User).order_by(User.created_at.desc()).all()


def create_user(db: Session, email: str, password_hash: str, role: str) -> User:
    """
    Persist a new user record.

    Args:
        db: active database session.
        email: unique user email (should be validated before calling).
        password_hash: pre-hashed password (never plain text).
        role: one of admin | analyst | viewer.

    Returns:
        The newly created User ORM object (with user_id populated).
    """
    user = User(email=email, password_hash=password_hash, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, data: dict) -> Optional[User]:
    """
    Update allowed fields on an existing user.

    Args:
        db: active database session.
        user_id: target user.
        data: dict of fields to update (keys must match User column names).

    Returns:
        Updated User object, or None if user_id not found.
    """
    user = get_user_by_id(db, user_id)
    if user is None:
        return None
    for field, value in data.items():
        if value is not None:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    """
    Delete a user record.

    Returns:
        True if deleted, False if user_id was not found.
    """
    user = get_user_by_id(db, user_id)
    if user is None:
        return False
    db.delete(user)
    db.commit()
    return True
