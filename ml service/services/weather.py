"""
services/weather.py
Fetch current weather for a location using the free Open-Meteo API.
No API key required. Results are cached for 30 minutes to avoid hammering
the endpoint on repeated analyses.

Default coordinates come from settings (DEFAULT_LAT / DEFAULT_LON env vars).
The caller can override lat/lon (e.g. if the user supplies field GPS coords).
"""

import time
import threading
from typing import Optional

import requests

from config.settings import settings
from utils.logger import logger

_CACHE_TTL = 1800   # 30 minutes
_TIMEOUT   = 10     # seconds

_cache_lock = threading.Lock()
_cache: dict = {}   # key=(lat,lon) -> {fetched_at, data}


def get_current_weather(
    lat: float | None = None,
    lon: float | None = None,
) -> dict:
    """
    Return a dict with current weather conditions relevant to crop disease:
    {
      "temperature_c":    float,
      "humidity_pct":     float,
      "precipitation_mm": float,   # last-hour rainfall
      "wind_speed_kmh":   float,
      "weather_code":     int,     # WMO code
      "weather_desc":     str,     # human-readable
      "disease_risk":     str,     # "Low" | "Moderate" | "High"
      "risk_reason":      str,
      "location":         str,
      "source":           str,
    }
    On failure returns a safe fallback dict with source="unavailable".
    """
    # Fall back to configured defaults (from .env / environment variables)
    _lat = lat if lat is not None else settings.DEFAULT_LAT
    _lon = lon if lon is not None else settings.DEFAULT_LON

    key = (round(_lat, 3), round(_lon, 3))
    with _cache_lock:
        cached = _cache.get(key)
        if cached and time.time() - cached["fetched_at"] < _CACHE_TTL:
            logger.info("Weather cache hit")
            return cached["data"]

    data = _fetch(_lat, _lon)
    with _cache_lock:
        _cache[key] = {"fetched_at": time.time(), "data": data}
    return data


# ── Internal ──────────────────────────────────────────────────────────────────

_WMO_DESCRIPTIONS = {
    0:  "Clear sky",
    1:  "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Icy fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Slight rain",  63: "Rain",      65: "Heavy rain",
    71: "Slight snow",  73: "Snow",      75: "Heavy snow",
    80: "Slight showers", 81: "Showers", 82: "Heavy showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Heavy thunderstorm",
}

def _weather_description(code: int) -> str:
    return _WMO_DESCRIPTIONS.get(code, f"Weather code {code}")

def _assess_disease_risk(temp: float, humidity: float, precip: float) -> tuple[str, str]:
    """
    Simple agronomic heuristic for fungal disease pressure.
    High humidity + moderate warmth = ideal conditions for Downy/Powdery Mildew.
    High rainfall + warm = Black Rot risk.
    """
    if humidity >= 85 and 15 <= temp <= 30:
        if precip > 2:
            return "High", (
                f"Hot and wet conditions (humidity {humidity:.0f}%, rain {precip:.1f} mm, "
                f"temp {temp:.1f}°C) strongly favour Black Rot and Downy Mildew spread."
            )
        return "High", (
            f"High humidity ({humidity:.0f}%) with warm temperatures ({temp:.1f}°C) "
            "create ideal conditions for Powdery Mildew and Downy Mildew."
        )
    elif humidity >= 70 and 10 <= temp <= 35:
        return "Moderate", (
            f"Moderately elevated humidity ({humidity:.0f}%) and temperature ({temp:.1f}°C) "
            "warrant continued scouting for early disease signs."
        )
    else:
        return "Low", (
            f"Current conditions (humidity {humidity:.0f}%, temp {temp:.1f}°C, "
            "rain {:.1f} mm) are unfavourable for major fungal disease spread.".format(precip)
        )


def _fetch(lat: float, lon: float) -> dict:
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,precipitation,"
        "weather_code,wind_speed_10m"
        "&wind_speed_unit=kmh&timezone=auto"
    )
    try:
        resp = requests.get(url, timeout=_TIMEOUT)
        resp.raise_for_status()
        j   = resp.json()
        cur = j["current"]

        temp   = float(cur.get("temperature_2m", 25))
        humid  = float(cur.get("relative_humidity_2m", 60))
        precip = float(cur.get("precipitation", 0))
        wind   = float(cur.get("wind_speed_10m", 0))
        wcode  = int(cur.get("weather_code", 0))

        risk, reason = _assess_disease_risk(temp, humid, precip)

        return {
            "temperature_c":    round(temp, 1),
            "humidity_pct":     round(humid, 1),
            "precipitation_mm": round(precip, 2),
            "wind_speed_kmh":   round(wind, 1),
            "weather_code":     wcode,
            "weather_desc":     _weather_description(wcode),
            "disease_risk":     risk,
            "risk_reason":      reason,
            "location":         j.get("timezone", f"{lat},{lon}"),
            "source":           "open-meteo.com",
        }
    except Exception as exc:
        logger.warning(f"Weather fetch failed: {exc}")
        return {
            "temperature_c":    None,
            "humidity_pct":     None,
            "precipitation_mm": None,
            "wind_speed_kmh":   None,
            "weather_code":     None,
            "weather_desc":     "Weather data unavailable",
            "disease_risk":     "Unknown",
            "risk_reason":      "Could not fetch weather data.",
            "location":         f"{lat},{lon}",
            "source":           "unavailable",
        }
