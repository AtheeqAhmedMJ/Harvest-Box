"""
services/report.py
Harvest Box — AI Crop Health Report Engine  (Production Grade)

Features
--------
• Unified prompt pipeline  (Gemini  →  HuggingFace fallback)
• Professional, structured agricultural reporting
• Weather-driven disease-risk predictions
• ASCII bar-charts for terminal / dashboard embedding
• Spatial + temporal field intelligence

Architecture
------------
  generate_report_text()          ← public entry-point
      └─ _generate_via_gemini()   ← primary LLM
          └─ _generate_via_hf()   ← fallback LLM
              └─ _build_prompt()  ← shared prompt factory
                  └─ _build_confidence_chart()
"""

from __future__ import annotations

import time
from typing import Any

import requests

from config.settings import settings
from utils.logger import logger

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

HF_API_URL: str = "https://router.huggingface.co/v1/chat/completions"
HF_MODEL: str = "Qwen/Qwen2.5-72B-Instruct"
GEMINI_MODEL: str = "gemini-2.5-flash"

MAX_RETRIES: int = 3
RETRY_DELAY_SEC: float = 2.0
MAX_OUTPUT_TOKENS: int = 6_000
TEMPERATURE: float = 0.55
CHART_WIDTH: int = 20          # ░/█ columns in ASCII bar charts
CHART_BAR_UNIT: int = 5        # each block = 5 %


# ─────────────────────────────────────────────────────────────────────────────
# Type aliases
# ─────────────────────────────────────────────────────────────────────────────

ScanResult = dict[str, Any]
WeatherData = dict[str, Any]
ForecastSummary = dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# System persona
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PERSONA: str = """
You are an AI-powered Crop Health Analysis System developed by Harvest Box.

You generate structured, professional agricultural reports used by:
  • Farmers
  • Agronomists
  • Agri-tech platforms

Style guidelines:
  • Formal, precise, and well-structured
  • Actionable and practical — never vague
  • Technically accurate yet easy to understand

Hard rules:
  • Always include exact dosages, timing, and product names
  • Use Indian agricultural context throughout
  • Explain WHY each recommendation works
""".strip()


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ascii_bar(value: float, width: int = CHART_WIDTH, unit: int = CHART_BAR_UNIT) -> str:
    """Return a fixed-width ASCII bar like  [████████░░░░░░░░░░░░]."""
    filled = min(int(value / unit), width)
    return f"[{'█' * filled}{'░' * (width - filled)}]"


def _build_confidence_chart(results: list[ScanResult]) -> str:
    """
    Build a multi-row ASCII bar chart from the probability distribution
    of the *first* scan result that carries ``all_probs``.

    Returns a ready-to-embed string, or ``'No probability data available'``
    when the required key is absent.
    """
    first_probs: dict[str, float] | None = None
    for r in results:
        if r.get("all_probs"):
            first_probs = r["all_probs"]
            break

    if not first_probs:
        return "No probability data available"

    lines: list[str] = []
    for label, pct in first_probs.items():
        bar = _ascii_bar(pct)
        lines.append(f"{label:<20} {bar} {pct:5.1f}%")

    return "\n".join(lines)


def _dominant_detection(results: list[ScanResult]) -> tuple[str, float]:
    """
    Return ``(disease_name, confidence)`` for the highest-confidence
    prediction across all scan-grid results.
    """
    dominant = "Unknown"
    best_conf = 0.0

    for r in results:
        conf: float = r.get("confidence", 0.0)
        if conf > best_conf:
            best_conf = conf
            dominant = r.get("prediction", "Unknown")

    return dominant, best_conf


def _format_weather_block(weather: WeatherData) -> str:
    """
    Render the current-weather section.
    Returns an empty string when weather data is unavailable.
    """
    if not weather or weather.get("source") == "unavailable":
        return ""

    return (
        "\nCURRENT WEATHER CONDITIONS\n"
        f"  Temperature  : {weather['temperature_c']} °C\n"
        f"  Humidity     : {weather['humidity_pct']} %\n"
        f"  Rainfall     : {weather['precipitation_mm']} mm\n"
        f"  Wind Speed   : {weather['wind_speed_kmh']} km/h\n"
        f"  Condition    : {weather['weather_desc']}\n"
        f"  Disease Risk : {weather.get('disease_risk', 'Unknown')}\n"
    )


def _format_history_block(forecast_summary: ForecastSummary | None) -> str:
    """
    Render the historical disease-count section.
    Returns an empty string when no forecast summary is provided.
    """
    if not forecast_summary:
        return ""

    counts = forecast_summary.get("disease_counts", {})
    return f"\nHISTORICAL SCAN DATA\n  Disease Counts: {counts}\n"


# ─────────────────────────────────────────────────────────────────────────────
# Prompt factory
# ─────────────────────────────────────────────────────────────────────────────

def _build_prompt(
    results: list[ScanResult],
    weather: WeatherData | None = None,
    forecast_summary: ForecastSummary | None = None,
    field_name: str = "",
) -> str:
    """
    Assemble the full LLM prompt from scan results, weather, and history.

    Parameters
    ----------
    results:
        List of per-grid scan dictionaries, each with ``row``, ``col``,
        ``prediction``, ``confidence``, and optionally ``all_probs``.
    weather:
        Current weather payload (may be ``None`` or flagged as unavailable).
    forecast_summary:
        Historical disease counts from earlier scans.
    field_name:
        Human-readable field identifier for the report header.

    Returns
    -------
    str
        A fully rendered prompt string ready to be passed to any LLM.
    """
    # ── Scan findings ──────────────────────────────────────────────────────
    findings_lines = [
        f"  Grid ({r.get('row')}, {r.get('col')}):  "
        f"{r.get('prediction', 'Unknown')}  ({r.get('confidence', 0.0):.1f}%)"
        for r in results
    ]
    findings_text = "\n".join(findings_lines) or "  No scan data provided."

    # ── Dominant disease & confidence ──────────────────────────────────────
    dominant_disease, max_confidence = _dominant_detection(results)
    confidence_chart = _build_confidence_chart(results)

    # ── Unique diseases detected ───────────────────────────────────────────
    all_diseases = list({r.get("prediction", "Unknown") for r in results if r.get("prediction")})
    diseases_list = ", ".join(all_diseases)

    # ── Optional blocks ────────────────────────────────────────────────────
    weather_block = _format_weather_block(weather)
    history_block = _format_history_block(forecast_summary)

    # ── Assemble ───────────────────────────────────────────────────────────
    divider = "═" * 60

    return f"""
{divider}
HARVEST BOX — AI CROP HEALTH REPORT
{divider}

FIELD            : {field_name or '(unnamed)'}
DOMINANT DISEASE : {dominant_disease}
ALL DETECTIONS   : {diseases_list}

CURRENT SCAN FINDINGS
{findings_text}
{weather_block}{history_block}
{divider}
REPORT REQUIREMENTS
{divider}

You are writing a FULL TEXT agricultural report about "{dominant_disease}".
Every section below MUST contain detailed written paragraphs — not just
bullet skeletons. Use your knowledge of this specific disease: its biology,
spread, symptoms, treatments, and Indian agricultural context.

Do NOT leave any section as a template placeholder.
Write as an expert agronomist explaining findings to a farmer.
Use ASCII bar-charts where indicated.

{'=' * 52}
1. EXECUTIVE SUMMARY
{'=' * 52}
  • 2–3 sentence overview of field health
  • Field Health Score  (x / 10)
  • Single most-critical immediate action

{'=' * 52}
2. DISEASE DIAGNOSIS
{'=' * 52}
  • Disease common name + scientific name
  • Causal agent and mode of spread
  • Symptom progression  (early → severe)

{'=' * 52}
3. WEATHER–DISEASE INTERACTION
{'=' * 52}
  • Explain how current humidity, rainfall, and temperature
    amplify or suppress disease pressure
  • Include a 7-day risk trend chart, for example:

    Risk Trend (illustrative):
    Mon  {_ascii_bar(30)}  30%
    Tue  {_ascii_bar(70)}  70%

{'=' * 52}
4. FORECAST & PROGRESSION  (next 14 days)
{'=' * 52}
  Scenario A — No Treatment
    (describe spread, estimated yield loss %)
  Scenario B — With Recommended Treatment
    (describe containment, estimated yield save %)

{'=' * 52}
5. TREATMENT PLAN
{'=' * 52}
  IMMEDIATE  (within 24–48 hours)
    CHEMICAL
      – Product name (Indian brand preferred)
      – Dosage and dilution
      – Spray timing and frequency

    ORGANIC / LOW-COST ALTERNATIVES
      – Biopesticide or botanical option
      – Application notes

{'=' * 52}
6. FIELD-LEVEL SPATIAL ANALYSIS
{'=' * 52}
  • List affected grid coordinates
  • Likely spread direction
  • Recommended buffer / quarantine zones

{'=' * 52}
7. MODEL CONFIDENCE
{'=' * 52}
  Overall confidence: {max_confidence:.0f}%

  Probability Distribution:
{confidence_chart}

  Briefly explain what the confidence score means in practice
  and when a human agronomist review is advised.

{'=' * 52}
8. MONITORING SCHEDULE
{'=' * 52}
  • Recommended rescan interval
  • Early-warning signs to watch between scans

{'=' * 52}
9. LONG-TERM PREVENTION STRATEGY
{'=' * 52}
  • Variety selection and crop-rotation advice
  • Soil health and nutrient management
  • Integrated Pest Management (IPM) calendar

{divider}
FINAL SUMMARY
{divider}
  Highlight the SINGLE MOST CRITICAL action the farmer must
  take in the next 24 hours, and the expected outcome.
"""


# ─────────────────────────────────────────────────────────────────────────────
# LLM backends
# ─────────────────────────────────────────────────────────────────────────────

def _generate_via_hf(
    results: list[ScanResult],
    weather: WeatherData | None,
    forecast_summary: ForecastSummary | None,
    field_name: str,
) -> str:
    """
    Call the HuggingFace Inference Router (Qwen 72B) with exponential-
    style retry logic.

    Returns the generated report text, or an error message string on
    total failure.
    """
    if not settings.HF_API_KEY:
        logger.error("HuggingFace API key is not configured.")
        return "ERROR: HuggingFace API key is missing."

    payload: dict[str, Any] = {
        "model": HF_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PERSONA},
            {
                "role": "user",
                "content": _build_prompt(results, weather, forecast_summary, field_name),
            },
        ],
        "max_tokens": MAX_OUTPUT_TOKENS,
        "temperature": TEMPERATURE,
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(
                HF_API_URL,
                headers={"Authorization": f"Bearer {settings.HF_API_KEY}"},
                json=payload,
                timeout=120,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

        except requests.exceptions.HTTPError as exc:
            logger.warning("HF attempt %d/%d — HTTP error: %s", attempt, MAX_RETRIES, exc)
        except requests.exceptions.Timeout:
            logger.warning("HF attempt %d/%d — request timed out.", attempt, MAX_RETRIES)
        except Exception as exc:  # noqa: BLE001
            logger.warning("HF attempt %d/%d — unexpected error: %s", attempt, MAX_RETRIES, exc)

        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY_SEC * attempt)

    logger.error("All %d HuggingFace attempts exhausted.", MAX_RETRIES)
    return "ERROR: Report generation failed after all retries (HuggingFace)."


def _generate_via_gemini(
    results: list[ScanResult],
    weather: WeatherData | None,
    forecast_summary: ForecastSummary | None,
    field_name: str,
) -> str:
    """
    Call Google Gemini Flash for report generation.

    Falls back automatically to ``_generate_via_hf`` if the API key is
    absent or if the Gemini call raises any exception.
    """
    if not settings.GEMINI_API_KEY:
        logger.info("Gemini API key absent — falling back to HuggingFace.")
        return _generate_via_hf(results, weather, forecast_summary, field_name)

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)

        full_prompt = f"{SYSTEM_PERSONA}\n\n{_build_prompt(results, weather, forecast_summary, field_name)}"

        response = model.generate_content(
            full_prompt,
            generation_config={
                "temperature": TEMPERATURE,
                "max_output_tokens": MAX_OUTPUT_TOKENS,
            },
        )
        return response.text

    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini generation failed (%s) — falling back to HuggingFace.", exc)
        return _generate_via_hf(results, weather, forecast_summary, field_name)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def generate_report_text(
    results: list[ScanResult],
    weather: WeatherData | None = None,
    forecast_summary: ForecastSummary | None = None,
    field_name: str = "",
) -> str:
    """
    Generate a full AI crop-health report and return it as a string.

    Selection logic
    ---------------
    • If ``settings.ENABLE_GEMINI`` is truthy → Gemini Flash (with HF fallback)
    • Otherwise → HuggingFace Qwen 72B directly

    Parameters
    ----------
    results:
        List of per-grid scan dictionaries produced by the vision model.
        Expected keys per item: ``row``, ``col``, ``prediction``,
        ``confidence``, ``all_probs`` (optional).
    weather:
        Current weather data dict, or ``None`` / ``{'source': 'unavailable'}``.
    forecast_summary:
        Historical disease summary with at minimum a ``disease_counts`` key.
    field_name:
        Human-readable name / ID for the field being analysed.

    Returns
    -------
    str
        The complete generated report, or an error string prefixed with
        ``'ERROR:'`` if all generation attempts fail.
    """
    if not results:
        logger.warning("generate_report_text called with empty results list.")
        return "ERROR: No scan results provided — cannot generate report."

    if settings.ENABLE_GEMINI:
        return _generate_via_gemini(results, weather, forecast_summary, field_name)

    return _generate_via_hf(results, weather, forecast_summary, field_name)