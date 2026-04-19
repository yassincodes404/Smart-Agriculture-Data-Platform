"""
core/config.py
--------------
Central configuration loader for the Smart Agriculture Data Platform backend.
Reads from .env.backend via environment variables.
All other modules should import settings from here — never read os.getenv directly.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    APP_ENV: str = "development"

    # Database
    DATABASE_URL: str = "mysql+pymysql://agri_user:agri_pass@mysql:3306/agriculture"

    # JWT / Auth
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # External services
    OPENAI_API_KEY: str = ""
    LOG_LEVEL: str = "INFO"
    LAND_MONITOR_INTERVAL_MINUTES: int = 1440

    model_config = {"env_file": ".env.backend", "extra": "ignore"}


# Singleton instance — import this everywhere
settings = Settings()
