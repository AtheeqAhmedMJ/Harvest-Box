"""
services/forecast_store.py
Persist per-user, per-cell analysis results to a local JSON file.
These records feed the report generator so it can show trends over time.

Schema of one record:
{
  "timestamp":   "2025-03-30T14:22:00",
  "user_id":     "42",
  "field_name":  "North Block",          # optional, supplied by caller
  "row":         2,
  "col":         3,
  "prediction":  "Black_Rot",
  "confidence":  87.4,
  "severity":    "high",
  "fusion_method": "hybrid_geometric_mean",
  "all_probs":   {"Black_Rot": 87.4, "Downy_Mildew": 5.1, ...}
}
"""

import json
import os
import threading
from datetime import datetime
from pathlib import Path

from utils.logger import logger

_STORE_DIR  = Path("forecast_data")
_FILE_NAME  = "analysis_history.json"
_lock       = threading.Lock()


def _store_path() -> Path:
    _STORE_DIR.mkdir(parents=True, exist_ok=True)
    return _STORE_DIR / _FILE_NAME


def save_result(
    user_id: str,
    row: int,
    col: int,
    prediction: str,
    confidence: float,
    severity: str,
    all_probs: dict,
    fusion_method: str = "local_only",
    field_name: str = "",
) -> None:
    """Append one analysis record to the persistent JSON store."""
    record = {
        "timestamp":     datetime.now().isoformat(timespec="seconds"),
        "user_id":       user_id,
        "field_name":    field_name,
        "row":           row,
        "col":           col,
        "prediction":    prediction,
        "confidence":    confidence,
        "severity":      severity,
        "fusion_method": fusion_method,
        "all_probs":     all_probs,
    }
    path = _store_path()
    with _lock:
        history = _load_raw(path)
        history.append(record)
        with open(path, "w") as f:
            json.dump(history, f, indent=2)
    logger.info(f"Forecast record saved: user={user_id} row={row} col={col} prediction={prediction}")


def get_history(user_id: str, limit: int = 200) -> list[dict]:
    """
    Return the most recent `limit` records for this user,
    sorted oldest-first (natural order for trend charts).
    """
    path = _store_path()
    with _lock:
        history = _load_raw(path)
    user_records = [r for r in history if r.get("user_id") == user_id]
    return user_records[-limit:]


def get_cell_history(user_id: str, row: int, col: int, limit: int = 50) -> list[dict]:
    """Return history for a specific grid cell."""
    all_records = get_history(user_id, limit=500)
    return [r for r in all_records if r["row"] == row and r["col"] == col][-limit:]


def get_field_summary(user_id: str) -> dict:
    """
    Aggregate statistics across all cells for a user.

    Returns:
    {
      "total_analyses": int,
      "disease_counts": {"Black_Rot": N, ...},
      "cell_disease_map": {"2,3": "Black_Rot", ...},
      "latest_by_cell":  {"2,3": {...record...}, ...},
      "trend": [last 30 records in chronological order],
    }
    """
    records = get_history(user_id, limit=500)
    if not records:
        return {
            "total_analyses": 0,
            "disease_counts": {},
            "cell_disease_map": {},
            "latest_by_cell": {},
            "trend": [],
        }

    disease_counts: dict[str, int] = {}
    latest_by_cell: dict[str, dict] = {}

    for r in records:
        pred = r.get("prediction", "Unknown")
        disease_counts[pred] = disease_counts.get(pred, 0) + 1
        key = f"{r['row']},{r['col']}"
        latest_by_cell[key] = r  # later records overwrite earlier ones

    cell_disease_map = {k: v["prediction"] for k, v in latest_by_cell.items()}

    return {
        "total_analyses": len(records),
        "disease_counts": disease_counts,
        "cell_disease_map": cell_disease_map,
        "latest_by_cell": latest_by_cell,
        "trend": records[-30:],
    }


# ── Private helpers ───────────────────────────────────────────────────────────

def _load_raw(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning(f"Could not read forecast store ({exc}). Starting fresh.")
        return []