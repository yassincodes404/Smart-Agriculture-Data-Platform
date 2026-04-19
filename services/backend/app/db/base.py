"""
db/base.py
----------
Import all SQLAlchemy models here so that:
1. Base.metadata.create_all() in main.py discovers every table.
2. Alembic autogenerate can detect all models.

Add every new model import below as the project grows.
"""

from app.models.user import Base, User  # noqa: F401
from app.models.location import Location  # noqa: F401
from app.models.ingestion_batch import IngestionBatch  # noqa: F401
from app.models.etl_error import EtlError  # noqa: F401
from app.models.climate_record import ClimateRecord  # noqa: F401
from app.models.water_record import WaterRecord  # noqa: F401
from app.models.land import Land  # noqa: F401
from app.models.data_source import DataSource  # noqa: F401
from app.models.land_climate import LandClimate  # noqa: F401
from app.models.land_water import LandWater  # noqa: F401
from app.models.land_crop import LandCrop  # noqa: F401
from app.models.land_soil import LandSoil  # noqa: F401
from app.models.land_image import LandImage  # noqa: F401
from app.models.analytics_summary import AnalyticsSummary  # noqa: F401
