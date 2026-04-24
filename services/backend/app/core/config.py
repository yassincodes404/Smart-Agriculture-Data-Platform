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

    # Sentinel-2 / Copernicus Data Space
    COPERNICUS_CLIENT_ID: str = ""
    COPERNICUS_CLIENT_SECRET: str = ""

    # Satellite monitoring
    SATELLITE_IMAGE_INTERVAL_DAYS: int = 5
    SATELLITE_MAX_CLOUD_COVER_PCT: float = 30.0

    # Analysis thresholds
    NDVI_ANOMALY_DROP_THRESHOLD: float = 0.15
    CLIMATE_STRESS_TEMP_THRESHOLD: float = 40.0
    DROUGHT_RAINFALL_THRESHOLD_MM: float = 2.0

    # Reference data path
    CROP_PROFILES_PATH: str = "data/reference/crop_profiles.json"

    model_config = {"env_file": ".env.backend", "extra": "ignore"}


# Singleton instance — import this everywhere
settings = Settings()
