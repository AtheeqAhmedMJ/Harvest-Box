"""
services/inference.py
Crop-disease classifier — Local DenseNet only.

Local model  : DenseNet121 (grape disease — Black_Rot / Downy_Mildew / Healthy / Powdery_Mildew)

The model is fine-tuned on the exact grape-disease image distribution and is
the primary inference engine. No remote/vision APIs are used.
"""


import io
import json
import logging
import math
import os
import threading
from typing import Optional

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from config.settings import settings
from utils.logger import logger

# ── Constants ─────────────────────────────────────────────────────────────────
CLASS_NAMES   = ["Black_Rot", "Downy_Mildew", "Healthy", "Powdery_Mildew"]
NUM_CLASSES   = len(CLASS_NAMES)
DEVICE        = torch.device("cpu")

_model = None
_lock  = threading.Lock()

_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


# ── Public API ────────────────────────────────────────────────────────────────

def load_model() -> None:
    """Called once at app startup (via lifespan). Thread-safe."""
    global _model
    with _lock:
        if _model is not None:
            return
        if not os.path.exists(settings.MODEL_PATH):
            raise FileNotFoundError(
                f"Model file not found at: {settings.MODEL_PATH}\n"
                f"Place best_grape_model.pth in the 'model/' directory."
            )
        m = models.densenet121(weights=None)
        m.classifier = nn.Linear(m.classifier.in_features, NUM_CLASSES)
        m.load_state_dict(torch.load(settings.MODEL_PATH, map_location=DEVICE))
        m.eval()
        _model = m
        logger.info(f"Local DenseNet loaded from {settings.MODEL_PATH} (version={settings.MODEL_VERSION})")


def predict_image(image_bytes: bytes) -> dict:
    """
    Run local DenseNet inference on raw image bytes.

    Returns:
    {
        "prediction":      str,          # winning class name
        "confidence":      float,        # 0-100 percentage
        "model_version":   str,
        "local_result":    dict,         # {prediction, confidence, probabilities}
        "gemini_result":   None,         # not used
        "fusion_method":   str,          # "local_only"
        "all_probs":       dict,         # {class: prob} (sums to 100)
    }
    """
    # ── Local model only ──────────────────────────────────────────────────────
    local_probs = _run_local_model(image_bytes)
    local_result = _probs_to_result(local_probs)

    hybrid_winner_idx = max(range(NUM_CLASSES), key=lambda i: local_probs[i])
    hybrid_confidence = round(local_probs[hybrid_winner_idx] * 100, 2)

    return {
        "prediction":    CLASS_NAMES[hybrid_winner_idx],
        "confidence":    hybrid_confidence,
        "model_version": settings.MODEL_VERSION,
        "local_result":  local_result,
        "gemini_result": None,
        "fusion_method": "local_only",
        "all_probs": {
            CLASS_NAMES[i]: round(local_probs[i] * 100, 2)
            for i in range(NUM_CLASSES)
        },
    }


# ── Internal helpers ──────────────────────────────────────────────────────────

def _run_local_model(image_bytes: bytes) -> list[float]:
    """Return softmax probability list for each class."""
    if _model is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")
    image  = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _transform(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        probs = torch.softmax(_model(tensor), dim=1)[0].tolist()
    return probs




def _geometric_mean_fusion(p_local: list[float], p_gemini: list[float],
                            w_local: float, w_gemini: float) -> list[float]:
    """
    Weighted geometric mean (log-domain) of two probability vectors.

        log p_hybrid[c] = w_local * log p_local[c] + w_gemini * log p_gemini[c]

    A floor of 1e-9 prevents log(0).  Re-normalised to sum=1 at the end.
    
    NOTE: This function is no longer used (hybrid approach removed).
    Kept for reference/future use only.
    """
    EPS = 1e-9
    log_hybrid = [
        w_local  * math.log(max(p_local[i],  EPS)) +
        w_gemini * math.log(max(p_gemini[i], EPS))
        for i in range(NUM_CLASSES)
    ]
    # Shift for numerical stability before exp
    max_log = max(log_hybrid)
    exp_vals = [math.exp(v - max_log) for v in log_hybrid]
    total    = sum(exp_vals)
    return [v / total for v in exp_vals]


def _probs_to_result(probs: list[float]) -> dict:
    """Convert a probability list to a labelled result dict."""
    winner_idx = max(range(NUM_CLASSES), key=lambda i: probs[i])
    return {
        "prediction":  CLASS_NAMES[winner_idx],
        "confidence":  round(probs[winner_idx] * 100, 2),
        "probabilities": {CLASS_NAMES[i]: round(probs[i] * 100, 2) for i in range(NUM_CLASSES)},
    }