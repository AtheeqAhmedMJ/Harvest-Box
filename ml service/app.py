"""
Crop Health ML Service — v2
Multi-user, production-grade.
"""

from contextlib import asynccontextmanager
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from services.inference import load_model
from routes.v1 import analyze, health as health_route
from middleware.error_handler import global_exception_handler
from utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model once at startup, release on shutdown."""
    logger.info("Starting ML Service v2")

    # Fail fast on missing credentials so the error is obvious at boot,
    # not buried inside the first request log.
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        logger.warning(
            "AWS credentials not found in settings — S3 operations will fail. "
            "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file."
        )
    else:
        logger.info(f"AWS credentials loaded for key={settings.AWS_ACCESS_KEY_ID[:8]}...")

    if not settings.S3_BUCKET:
        raise RuntimeError("S3_BUCKET is not set in .env")

    logger.info(f"S3 bucket: {settings.S3_BUCKET} ({settings.AWS_REGION})")

    load_model()
    logger.info("Model loaded and ready")
    yield
    logger.info("ML Service shutting down")


app = FastAPI(
    title="Crop Health ML Service",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REQUEST ID + TIMING ───────────────────────────────────────────────────────
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()

    response = await call_next(request)

    duration = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration}ms"

    logger.info(
        f"[{request_id}] {request.method} {request.url.path} "
        f"-> {response.status_code} ({duration}ms)"
    )
    return response

# ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
app.add_exception_handler(Exception, global_exception_handler)

# ── ROUTES ────────────────────────────────────────────────────────────────────
app.include_router(health_route.router, prefix="/api/v1", tags=["health"])
app.include_router(analyze.router,      prefix="/api/v1", tags=["analyze"])
