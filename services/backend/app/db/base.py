"""
db/base.py
----------
Import all SQLAlchemy models here so that:
1. Base.metadata.create_all() in main.py discovers every table.
2. Alembic autogenerate can detect all models.

Add every new model import below as the project grows.
"""

from app.models.user import Base, User  # noqa: F401
