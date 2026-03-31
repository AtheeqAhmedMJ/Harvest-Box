"""
utils/logger.py
Structured logger with timestamp, level, and message.
"""

import logging
import sys
from config.settings import settings


def _build_logger() -> logging.Logger:
    logger = logging.getLogger("ml-service")
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        fmt = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
        handler.setFormatter(fmt)
        logger.addHandler(handler)

    return logger


logger = _build_logger()
