import os
from pydantic import BaseModel

_default_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "railway_blocks.db"))

class Settings(BaseModel):
    APP_NAME: str = "Indian Railways AI Block Planning System"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{_default_db_path}")
    RANDOM_SEED: int = 42

    # Priority Engine Weights (configurable)
    WEIGHT_DECLARED_URGENCY: float = 0.35
    WEIGHT_ASSET_RISK: float = 0.30
    WEIGHT_DUE_DATE: float = 0.20
    WEIGHT_WEATHER_RISK: float = 0.15

    # Thresholds
    DRIFT_ALERT_THRESHOLD: float = 2.5  # Disruption score delta trigger
    
    # Model Artifacts Directory
    MODEL_DIR: str = os.path.join(os.path.dirname(__file__), "ml_artifacts")

settings = Settings()
