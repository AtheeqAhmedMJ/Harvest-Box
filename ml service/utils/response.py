"""
utils/response.py
Standard JSON envelope helper.

NOTE: analyze_field does NOT use this — it returns a flat dict so the
Java backend can read top-level keys directly with Map.get("pdf_url").
This is used only by health.py and any future admin endpoints.
"""

from typing import Any, Optional
from fastapi import Request


def success(data: Any, request: Optional[Request] = None) -> dict:
    return {
        "success":   True,
        "data":      data,
        "error":     None,
        "requestId": getattr(getattr(request, "state", None), "request_id", None),
    }


def error(message: str, request: Optional[Request] = None) -> dict:
    return {
        "success":   False,
        "data":      None,
        "error":     message,
        "requestId": getattr(getattr(request, "state", None), "request_id", None),
    }
