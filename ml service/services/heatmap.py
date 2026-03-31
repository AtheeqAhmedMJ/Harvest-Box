"""
services/heatmap.py
Build a coordinate-keyed heatmap from ML predictions.
"""

SEVERITY_MAP = {
    "Healthy":        "none",
    "Black_Rot":      "high",
    "Downy_Mildew":   "medium",
    "Powdery_Mildew": "medium",
}


def build_heatmap(cells: list) -> dict:
    """
    Returns a dict keyed by "row,col" with disease, confidence, and severity.
    """
    heatmap = {}
    for c in cells:
        key = f"{c['row']},{c['col']}"
        heatmap[key] = {
            "disease":    c["prediction"],
            "confidence": c["confidence"],
            "severity":   SEVERITY_MAP.get(c["prediction"], "unknown"),
        }
    return heatmap
