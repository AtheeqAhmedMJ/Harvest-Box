"""
config/settings.py
All environment variables in one place.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=_ROOT / ".env", override=True)


class Settings:
    def __init__(self):
        # ── AWS ───────────────────────────────────────────────────────────────
        self.AWS_ACCESS_KEY_ID:     str  = os.getenv("AWS_ACCESS_KEY_ID", "")
        self.AWS_SECRET_ACCESS_KEY: str  = os.getenv("AWS_SECRET_ACCESS_KEY", "")
        self.AWS_REGION:            str  = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
        self.S3_BUCKET:             str  = os.getenv("S3_BUCKET", "harvest-box-bucket")

        # ── AI providers ──────────────────────────────────────────────────────
        self.HF_API_KEY:            str  = os.getenv("HF_API_KEY", "")
        self.GEMINI_API_KEY:        str  = os.getenv("GEMINI_API_KEY", "")

        # ── Feature flags ─────────────────────────────────────────────────────
        # ENABLE_GEMINI=true  → Gemini is used for BOTH vision inference (hybrid)
        #                       AND report text generation.
        # ENABLE_FORECAST=true → Historical scan results are persisted and used
        #                        in report generation.
        self.ENABLE_GEMINI:         bool = os.getenv("ENABLE_GEMINI", "false").lower() == "true"
        self.ENABLE_FORECAST:       bool = os.getenv("ENABLE_FORECAST", "true").lower() == "true"

        # ── Weather ───────────────────────────────────────────────────────────
        # Default field coordinates (Bengaluru — override per-request via lat/lon params)
        self.DEFAULT_LAT:           float = float(os.getenv("DEFAULT_LAT", "12.9716"))
        self.DEFAULT_LON:           float = float(os.getenv("DEFAULT_LON", "77.5946"))

        # ── CORS ──────────────────────────────────────────────────────────────
        self.CORS_ORIGINS:          list = os.getenv("CORS_ORIGINS", "*").split(",")

        # ── App ───────────────────────────────────────────────────────────────
        self.ENV:                   str  = os.getenv("ENV", "development")
        self.LOG_LEVEL:             str  = os.getenv("LOG_LEVEL", "INFO")

        # ── Model ─────────────────────────────────────────────────────────────
        self.MODEL_PATH:            str  = str(_ROOT / "model" / "best_grape_model.pth")
        self.MODEL_VERSION:         str  = os.getenv("MODEL_VERSION", "v1")


settings = Settings()