"""
routes/v1/analyze.py
POST /api/v1/analyze-field

Backend (MLClientService.java) sends:
  { "row": int, "col": int, "image_urls": [...], "user_id": "string",
    "field_name": "string (optional)", "lat": float (optional), "lon": float (optional) }

Backend (PlantService.java) reads from the response:
  response.get("pdf_url")       -> String  -> plant.reportPdfUrl
  response.get("prediction")    -> String  -> plant.health
  response.get("severity")      -> String  -> used to compute plant.severity
  response.get("confidence")    -> Double  -> confidence percentage
  response.get("heatmap")       -> Map     -> stored for future use

CRITICAL CONTRACT:
  The top-level response dict MUST contain:
    - "pdf_url"    (String)   — NOT nested under "data"
    - "prediction" (String)   — disease class name
    - "confidence" (Double)   — 0-100 float
    - "severity"   (String)   — "none" | "medium" | "high"
    - "heatmap"    (Map)      — keyed by "row,col"
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from config.settings     import settings
from services.inference  import predict_image
from services.storage    import download_image, upload_pdf
from services.heatmap    import build_heatmap
from services.report     import generate_report_text
from services.pdf        import generate_pdf
from services.aggregation import aggregate_predictions
from services.forecast_store import save_result, get_field_summary
from services.weather    import get_current_weather
from utils.logger        import logger

router = APIRouter()


# ── Request model ─────────────────────────────────────────────────────────────

class FieldRequest(BaseModel):
    row:        int
    col:        int
    image_urls: List[str]
    user_id:    Optional[str]   = Field(default=None, description="Caller's user ID")
    field_name: Optional[str]   = Field(default="",   description="Human-readable field / block name")
    lat:        Optional[float] = Field(default=None, description="Field latitude for weather lookup")
    lon:        Optional[float] = Field(default=None, description="Field longitude for weather lookup")


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/analyze-field")
def analyze_field(data: FieldRequest, request: Request):
    """
    Main analysis endpoint.

    Returns a FLAT dict (no envelope wrapper) because the Java backend reads
    fields directly with Map.get("pdf_url"), Map.get("prediction"), etc.
    """
    user_id    = data.user_id or "anonymous"
    field_name = data.field_name or ""
    rid        = getattr(getattr(request, "state", None), "request_id", str(uuid.uuid4()))

    logger.info(
        f"[{rid}] analyze-field user={user_id} row={data.row} col={data.col} "
        f"images={len(data.image_urls)} field='{field_name}'"
    )

    if not data.image_urls:
        raise HTTPException(status_code=400, detail="image_urls must not be empty")

    # ── 1. Inference per image ────────────────────────────────────────────────
    per_image_results = []
    for url in data.image_urls:
        try:
            image_bytes = download_image(url)
            result      = predict_image(image_bytes)
            result["row"]       = data.row
            result["col"]       = data.col
            result["image_url"] = url
            per_image_results.append(result)
        except Exception as e:
            logger.error(f"[{rid}] Failed to process image {url}: {e}")
            continue

    if not per_image_results:
        raise HTTPException(status_code=422, detail="All images failed to process")

    # ── 2. Aggregate multi-image predictions ──────────────────────────────────
    consensus = aggregate_predictions(per_image_results)
    consensus["row"] = data.row
    consensus["col"] = data.col

    if len(per_image_results) == 1:
        for key in ("local_result", "gemini_result", "fusion_method", "all_probs"):
            if key in per_image_results[0]:
                consensus[key] = per_image_results[0][key]

    # ── 3. Build heatmap ──────────────────────────────────────────────────────
    heatmap      = build_heatmap([consensus])
    cell_key     = f"{data.row},{data.col}"
    severity_str = heatmap[cell_key]["severity"]
    severity_num = _severity_to_float(severity_str)
    consensus["severity"] = severity_str

    # ── 4. Fetch weather — use caller lat/lon, fall back to settings defaults ─
    weather = get_current_weather(
        lat=data.lat,   # weather.py handles None → settings.DEFAULT_LAT
        lon=data.lon,
    )

    # ── 5. Save to forecast store ─────────────────────────────────────────────
    save_result(
        user_id       = user_id,
        row           = data.row,
        col           = data.col,
        prediction    = consensus["prediction"],
        confidence    = consensus["confidence"],
        severity      = severity_str,
        all_probs     = consensus.get("all_probs", {}),
        fusion_method = consensus.get("fusion_method", "local_only"),
        field_name    = field_name,
    )

    # ── 6. Load historical forecast summary ───────────────────────────────────
    forecast_summary = get_field_summary(user_id)

    # ── 7. Generate AI report text ────────────────────────────────────────────
    report_text = generate_report_text(
        results          = [consensus],
        weather          = weather,
        forecast_summary = forecast_summary,
        field_name       = field_name,
    )

    # ── 8. Generate PDF & upload to S3 ────────────────────────────────────────
    cells_for_pdf = [{**consensus, "severity": severity_str}]
    pdf_local = generate_pdf(
        report_text      = report_text,
        cells            = cells_for_pdf,
        user_id          = user_id,
        field_name       = field_name,
        weather          = weather,
        forecast_summary = forecast_summary,
    )
    pdf_key = f"reports/{user_id}/field_r{data.row}_c{data.col}_{uuid.uuid4()}.pdf"
    pdf_url = upload_pdf(pdf_local, pdf_key)

    # ── 9. Return FLAT response ───────────────────────────────────────────────
    return {
        # Keys the Java backend reads directly
        "pdf_url":      pdf_url,
        "prediction":   consensus["prediction"],
        "confidence":   consensus["confidence"],
        "severity":     severity_str,
        "severity_num": severity_num,

        # Extended fields
        "row":          data.row,
        "col":          data.col,
        "field_name":   field_name,
        "userId":       user_id,
        "modelVersion": consensus.get("model_version", "v1"),
        "imageCount":   len(per_image_results),
        "imageBreakdown": consensus.get("imageBreakdown", []),
        "heatmap":      heatmap,
        "reportText":   report_text,
        "results":      per_image_results,

        "fusionMethod": consensus.get("fusion_method", "local_only"),
        "localResult":  consensus.get("local_result"),
        "geminiResult": consensus.get("gemini_result"),
        "allProbs":     consensus.get("all_probs", {}),
        "weather":      weather,
        "forecastSummary": {
            "totalAnalyses": forecast_summary.get("total_analyses", 0),
            "diseaseCounts": forecast_summary.get("disease_counts", {}),
        },
    }


def _severity_to_float(severity: str) -> float:
    return {"none": 0.0, "medium": 0.5, "high": 1.0}.get(severity, 0.0)
