"""
middleware/error_handler.py
Global exception handler — returns flat JSON (no envelope) so Java backend
can parse error detail from the "detail" field as expected by MLClientService.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from utils.logger import logger


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(getattr(request, "state", None), "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled exception: {type(exc).__name__}: {exc}")

    return JSONResponse(
        status_code=500,
        content={
            "detail":    "An internal error occurred. Please try again.",
            "requestId": request_id,
        },
    )
