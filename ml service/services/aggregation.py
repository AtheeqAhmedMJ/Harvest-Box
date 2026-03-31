"""
services/aggregation.py
Aggregate ML predictions from multiple images of the same field cell.
Uses confidence-weighted voting — highest total confidence wins.
"""

from collections import defaultdict


def aggregate_predictions(predictions: list[dict]) -> dict:
    """
    Given a list of per-image prediction dicts, return a single consensus dict.

    Input:  [{"prediction": "Black_Rot", "confidence": 87.4, ...}, ...]
    Output: {"prediction": ..., "confidence": ..., "imageBreakdown": [...], "model_version": ...}
    """
    if not predictions:
        return {"prediction": "Unknown", "confidence": 0.0, "imageBreakdown": []}

    if len(predictions) == 1:
        p = predictions[0]
        return {
            "prediction":     p["prediction"],
            "confidence":     p["confidence"],
            "imageBreakdown": predictions,
            "model_version":  p.get("model_version", "v1"),
        }

    score: dict[str, float] = defaultdict(float)
    for p in predictions:
        score[p["prediction"]] += p["confidence"]

    winner   = max(score, key=score.__getitem__)
    win_preds = [p for p in predictions if p["prediction"] == winner]
    avg_conf  = round(sum(p["confidence"] for p in win_preds) / len(win_preds), 2)

    return {
        "prediction":     winner,
        "confidence":     avg_conf,
        "imageBreakdown": predictions,
        "model_version":  predictions[0].get("model_version", "v1"),
    }
