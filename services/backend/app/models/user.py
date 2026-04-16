"""
models/user.py
--------------
SQLAlchemy ORM definition for the `users` table.

Schema from documents/backend/database-design.md:
  user_id       BIGINT PK AUTO_INCREMENT
  email         VARCHAR(255) UNIQUE NOT NULL
  password_hash VARCHAR(255) NOT NULL
  role          VARCHAR(50) NOT NULL (admin | analyst | viewer)
  is_active     BOOLEAN DEFAULT TRUE
  created_at    TIMESTAMP
  updated_at    TIMESTAMP
"""

from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    # Use Integer (not BigInteger) so SQLite autoincrement works in tests.
    # MySQL will still store this as a standard int (sufficient for user counts).
    # If you need > 2B users, switch to BigInteger and run only against MySQL.
    user_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="viewer")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.user_id} email={self.email} role={self.role}>"

