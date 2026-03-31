"""
routes/v1/health.py
Health and readiness endpoints.
"""

from fastapi import APIRouter
from config.settings import settings

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status":   "ok",
        "service":  "Crop Health ML Service",
        "version":  "2.0.0",
        "env":      settings.ENV,
        "features": {
            "gemini":   settings.ENABLE_GEMINI,
            "forecast": settings.ENABLE_FORECAST,
        },
    }


@router.get("/")
def root():
    return {"status": "ML Service Running"}
