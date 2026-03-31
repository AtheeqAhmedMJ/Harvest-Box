"""
services/pdf.py
PDF report generator with charts and visualisations using fpdf2 + matplotlib.

Sections
────────
1. Cover / header
2. Executive summary (AI text)
3. AI confidence chart  — bar chart of all-class hybrid probabilities per cell
4. Disease distribution pie chart  — how many cells per disease
5. Severity heatmap table  — colour-coded grid
6. Historical trend chart  — disease occurrence over time (if forecast data present)
7. Weather panel
8. Detailed grid analysis table
9. Footer / disclaimer
"""

import io
import math
import os
import re
from datetime import datetime

import matplotlib
matplotlib.use("Agg")   # non-interactive backend — must come before pyplot import
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from fpdf import FPDF


# ── Colour palette ────────────────────────────────────────────────────────────
DISEASE_COLORS = {
    "Healthy":        "#2ecc71",
    "Black_Rot":      "#e74c3c",
    "Downy_Mildew":   "#e67e22",
    "Powdery_Mildew": "#9b59b6",
    "Unknown":        "#95a5a6",
}

SEVERITY_COLORS = {
    "none":    "#2ecc71",
    "medium":  "#f39c12",
    "high":    "#e74c3c",
    "unknown": "#bdc3c7",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe(text: str) -> str:
    """Strip markdown and ensure latin-1 safety for fpdf2."""
    if not text:
        return ""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"#+\s*", "", text)
    text = re.sub(r"-\s+", "", text)
    text = re.sub(r"`", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Normalize common unicode punctuation to latin-1 safe equivalents
    text = (text
            .replace("—", "-")   # em dash
            .replace("–", "-")   # en dash
            .replace("“", '"')
            .replace("”", '"')
            .replace("‘", "'")
            .replace("’", "'"))
    return text.encode("latin-1", "ignore").decode("latin-1")


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _fig_to_bytes(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    buf.seek(0)
    return buf.read()


# ── Chart generators ──────────────────────────────────────────────────────────

def _make_confidence_chart(cells: list) -> bytes:
    """
    Grouped horizontal bar chart.
    Each cell gets a group of bars, one bar per class.
    """
    classes = ["Black_Rot", "Downy_Mildew", "Healthy", "Powdery_Mildew"]
    bar_colors = [DISEASE_COLORS[c] for c in classes]

    n_cells = len(cells)
    x = np.arange(len(classes))
    width = max(0.08, 0.6 / max(n_cells, 1))

    fig, ax = plt.subplots(figsize=(8, 4))
    for i, cell in enumerate(cells):
        probs = cell.get("all_probs", {})
        vals  = [probs.get(c, 0) for c in classes]
        offset = (i - n_cells / 2 + 0.5) * width
        bars = ax.bar(x + offset, vals, width, label=f"({cell['row']},{cell['col']})",
                      color=bar_colors, alpha=0.8, edgecolor="white")

    ax.set_xticks(x)
    ax.set_xticklabels(["Black Rot", "Downy\nMildew", "Healthy", "Powdery\nMildew"],
                       fontsize=9)
    ax.set_ylabel("Confidence (%)", fontsize=9)
    ax.set_title("Hybrid Model — Class Probability by Grid Cell", fontsize=11, fontweight="bold")
    ax.set_ylim(0, 110)
    ax.legend(title="Grid cell", fontsize=8, title_fontsize=8)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()

    data = _fig_to_bytes(fig)
    plt.close(fig)
    return data


def _make_disease_pie(cells: list) -> bytes:
    """Pie chart showing disease distribution across all analysed cells."""
    from collections import Counter
    counts = Counter(c.get("prediction", "Unknown") for c in cells)
    labels = list(counts.keys())
    sizes  = list(counts.values())
    colors = [DISEASE_COLORS.get(l, "#95a5a6") for l in labels]

    fig, ax = plt.subplots(figsize=(5, 4))
    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors,
        autopct="%1.0f%%", startangle=90,
        textprops={"fontsize": 9},
    )
    for at in autotexts:
        at.set_fontsize(8)
    ax.set_title("Disease Distribution", fontsize=11, fontweight="bold")
    fig.tight_layout()

    data = _fig_to_bytes(fig)
    plt.close(fig)
    return data


def _make_trend_chart(trend_records: list) -> bytes:
    """
    Line/scatter chart of disease occurrences over time.
    Shows how many infected cells were found per scan date.
    """
    if not trend_records:
        return b""

    # Bucket by date
    from collections import defaultdict
    date_counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "infected": 0})
    for r in trend_records:
        date = r.get("timestamp", "")[:10]
        date_counts[date]["total"] += 1
        if r.get("prediction") != "Healthy":
            date_counts[date]["infected"] += 1

    dates = sorted(date_counts.keys())
    infected = [date_counts[d]["infected"] for d in dates]
    total    = [date_counts[d]["total"]    for d in dates]

    fig, ax = plt.subplots(figsize=(8, 3.5))
    x = range(len(dates))
    ax.fill_between(x, infected, alpha=0.3, color="#e74c3c", label="Infected cells")
    ax.plot(x, infected, "o-", color="#e74c3c", linewidth=2, markersize=5)
    ax.plot(x, total, "s--", color="#3498db", linewidth=1.5, markersize=4, label="Total scanned")
    ax.set_xticks(list(x))
    ax.set_xticklabels(dates, rotation=35, ha="right", fontsize=7)
    ax.set_ylabel("No. of cells", fontsize=9)
    ax.set_title("Historical Disease Trend (Previous Scans)", fontsize=11, fontweight="bold")
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)
    fig.tight_layout()

    data = _fig_to_bytes(fig)
    plt.close(fig)
    return data


def _make_model_comparison_chart(cells: list) -> bytes:
    """
    Side-by-side comparison of local vs Gemini vs hybrid confidence for top class.
    """
    valid = [c for c in cells if c.get("local_result") and c.get("gemini_result")]
    if not valid:
        return b""

    labels   = [f"({c['row']},{c['col']})" for c in valid]
    local_c  = [c["local_result"]["confidence"]  for c in valid]
    gemini_c = [c["gemini_result"]["confidence"] for c in valid]
    hybrid_c = [c["confidence"]                  for c in valid]

    x     = np.arange(len(labels))
    width = 0.25
    fig, ax = plt.subplots(figsize=(max(6, len(valid) * 1.5), 4))

    ax.bar(x - width, local_c,  width, label="Local Model (60%)",  color="#3498db", alpha=0.85)
    ax.bar(x,         gemini_c, width, label="Gemini Vision (40%)", color="#9b59b6", alpha=0.85)
    ax.bar(x + width, hybrid_c, width, label="Hybrid Result",       color="#2ecc71", alpha=0.85)

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("Confidence (%) — Predicted Class", fontsize=9)
    ax.set_title("Model Comparison: Local vs Gemini vs Hybrid", fontsize=11, fontweight="bold")
    ax.set_ylim(0, 110)
    ax.legend(fontsize=8)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()

    data = _fig_to_bytes(fig)
    plt.close(fig)
    return data


# ── Main PDF generator ────────────────────────────────────────────────────────

def generate_pdf(
    report_text: str,
    cells: list,
    user_id: str = "unknown",
    field_name: str = "",
    weather: dict | None = None,
    forecast_summary: dict | None = None,
) -> str:
    """
    Generate an enhanced crop-health PDF with charts.
    Returns the local file path.
    """
    os.makedirs("reports", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename  = f"reports/field_report_{user_id}_{timestamp}.pdf"

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=10)
    pdf.add_page()
    epw = pdf.epw

    # ── Cover / Title ─────────────────────────────────────────────────────────
    pdf.set_fill_color(34, 139, 34)
    pdf.rect(0, 0, pdf.w, 32, style="F")

    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_y(5)
    pdf.cell(epw + pdf.l_margin + pdf.r_margin, 9,
             "Crop Health Report", ln=True, align="C")

    pdf.set_font("Helvetica", "", 9)
    display_name = field_name if field_name else "Field Analysis"
    pdf.cell(epw + pdf.l_margin + pdf.r_margin, 7, display_name, ln=True, align="C")

    pdf.set_font("Helvetica", "", 8)
    pdf.cell(epw + pdf.l_margin + pdf.r_margin, 5,
             f"Generated: {datetime.now().strftime('%d %b %Y, %H:%M')}",
             ln=True, align="C")

    pdf.set_text_color(0, 0, 0)
    pdf.set_y(36)

    # ── Weather strip ─────────────────────────────────────────────────────────
    if weather and weather.get("source") != "unavailable":
        risk = weather.get("disease_risk", "Unknown")
        risk_color = {"Low": (39, 174, 96), "Moderate": (230, 126, 34),
                      "High": (231, 76, 60), "Unknown": (127, 140, 141)}
        rc = risk_color.get(risk, (127, 140, 141))

        pdf.set_fill_color(245, 245, 245)
        pdf.rect(pdf.l_margin, pdf.get_y(), epw, 12, style="F")
        pdf.set_xy(pdf.l_margin + 2, pdf.get_y() + 1)

        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(25, 4, "WEATHER", ln=False)
        pdf.set_font("Helvetica", "", 8)
        weather_text = (
            f"{weather.get('weather_desc','')} | "
            f"{weather.get('temperature_c','?')}C | "
            f"{weather.get('humidity_pct','?')}% | "
            f"{weather.get('precipitation_mm','?')}mm"
        )
        pdf.cell(0, 4, weather_text[:70], ln=True)

        pdf.set_x(pdf.l_margin + 2)
        pdf.set_font("Helvetica", "B", 8)
        r, g, b = rc
        pdf.set_text_color(r, g, b)
        pdf.cell(0, 4, f"Disease Pressure: {risk}", ln=True)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(1)

    pdf.ln(1)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(2)

    # ── AI Field Summary ──────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(epw, 6, "AI Field Summary", ln=True)
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 9)
    line_count = 0
    for line in report_text.split("\n"):
        if pdf.get_y() > 240:
            pdf.add_page()
        stripped = line.strip()
        if not stripped:
            pdf.ln(1)
            continue
        # Bold section headings
        if stripped.isupper() or (stripped.endswith(":") and len(stripped) < 60):
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(epw, 5, _safe(stripped[:80]))
            pdf.set_font("Helvetica", "", 9)
        else:
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(epw, 5, _safe(line[:120]))
        line_count += 1

    pdf.ln(1)
    if pdf.get_y() > 240:
        pdf.add_page()
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(2)

    # ── Charts ────────────────────────────────────────────────────────────────
    if pdf.get_y() > 240:
        pdf.add_page()
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(epw, 6, "Visual Analysis", ln=True)
    pdf.ln(1)

    def _insert_chart(img_bytes: bytes, caption: str, width: float = None) -> None:
        if not img_bytes:
            return
        # Page break if needed
        chart_height = (width or epw) * 0.5
        if pdf.get_y() + chart_height > 240:
            pdf.add_page()
        w = min(width or epw, epw)
        tmp = f"/tmp/_chart_{id(img_bytes)}.png"
        with open(tmp, "wb") as f:
            f.write(img_bytes)
        pdf.set_x(pdf.l_margin)
        pdf.image(tmp, x=pdf.l_margin, w=w, h=w*0.5)
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(epw, 3, _safe(caption[:60]), ln=True, align="C")
        pdf.set_text_color(0, 0, 0)
        pdf.ln(1)
        try:
            os.unlink(tmp)
        except:
            pass

    # 1. Confidence chart
    conf_chart = _make_confidence_chart(cells)
    _insert_chart(conf_chart, "Figure 1: Class probability per grid cell")

    # 2. Disease distribution pie
    pie_chart = _make_disease_pie(cells)
    if pie_chart:
        _insert_chart(pie_chart, "Figure 2: Disease distribution", width=epw * 0.6)

    # 3. Historical trend (only if space available)
    if forecast_summary and forecast_summary.get("trend"):
        if pdf.get_y() > 200:
            pdf.add_page()
        trend_chart = _make_trend_chart(forecast_summary["trend"])
        _insert_chart(trend_chart, "Figure 3: Historical disease trend")

    pdf.ln(1)
    if pdf.get_y() > 230:
        pdf.add_page()
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(2)

    # ── Historical forecast summary ───────────────────────────────────────────
    if forecast_summary and forecast_summary.get("total_analyses", 0) > 0:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(epw, 5, "Forecast & Historical Context", ln=True)
        pdf.ln(0.5)
        pdf.set_font("Helvetica", "", 8)

        total    = forecast_summary.get("total_analyses", 0)
        d_counts = forecast_summary.get("disease_counts", {})
        cell_map = forecast_summary.get("cell_disease_map", {})
        infected = [k for k, v in cell_map.items() if v != "Healthy"]

        pdf.set_x(pdf.l_margin)
        summary_text = (
            f"Scans: {total} | "
            + ", ".join(f"{d}:{n}" for d, n in d_counts.items())[:50] + " | "
            + (f"Infected: {', '.join(infected[:3])}" if infected else "No infected")
        )
        pdf.multi_cell(epw, 4, _safe(summary_text))
        pdf.ln(1)

    # ── Detailed Grid Analysis table ──────────────────────────────────────────
    if pdf.get_y() > 220:
        pdf.add_page()
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(epw, 5, "Grid Analysis", ln=True)
    pdf.ln(0.5)

    # Table header — compact
    col_w = [18, 18, 35, 20, 18, 25]
    headers = ["Row", "Col", "Disease", "Conf%", "Severity", "Method"]
    pdf.set_fill_color(34, 139, 34)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 8)
    for h, w in zip(headers, col_w):
        pdf.cell(w, 5, h, border=1, align="C", fill=True)
    pdf.ln()
    pdf.set_text_color(0, 0, 0)

    pdf.set_font("Helvetica", "", 8)
    for idx, c in enumerate(cells):
        if pdf.get_y() > 250:
            pdf.add_page()
            pdf.set_fill_color(34, 139, 34)
            pdf.set_text_color(255, 255, 255)
            pdf.set_font("Helvetica", "B", 8)
            for h, w in zip(headers, col_w):
                pdf.cell(w, 5, h, border=1, align="C", fill=True)
            pdf.ln()
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("Helvetica", "", 8)

        pdf.set_fill_color(245, 245, 245)
        row_vals = [
            str(c.get("row", "?")),
            str(c.get("col", "?")),
            _safe(c.get("prediction", "Unknown")[:15]),
            f"{c.get('confidence', 0):.0f}",
            c.get("severity", "?")[:3].upper(),
            c.get("fusion_method", "local")[:6],
        ]
        for val, w in zip(row_vals, col_w):
            pdf.cell(w, 5, val, border=1, align="C", fill=True)
        pdf.ln()

    # Per-cell probability breakdown — skip if space limited
    if pdf.get_y() < 200 and cells:
        pdf.ln(1)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(epw, 4, "Class Probabilities (Sample)", ln=True)
        pdf.ln(0.5)
        pdf.set_font("Helvetica", "", 8)

        for c in cells[:2]:
            if pdf.get_y() > 240:
                break
            probs = c.get("all_probs", {})
            if not probs:
                continue
            header = f"Cell ({c.get('row','?')},{c.get('col','?')}) - {c.get('prediction','?')}"
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(epw, 3, _safe(header), ln=True)
            pdf.set_font("Helvetica", "", 7)

            bar_scale = epw / 100.0
            for cls, prob in list(probs.items())[:4]:
                color = _hex_to_rgb(DISEASE_COLORS.get(cls, "#95a5a6"))
                label_w = 35
                bar_w = max(1.0, prob * bar_scale * 0.8)
                pdf.set_x(pdf.l_margin)
                pdf.cell(label_w, 3, _safe(f"{cls}:"), border=0)
                pdf.set_fill_color(*color)
                pdf.cell(bar_w, 3, "", border=0, fill=True)
                pdf.cell(15, 3, f"{prob:.0f}%", ln=True)
            pdf.ln(0.5)

    # ── Footer ────────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(120, 120, 120)
    # Position footer at end
    footer_y = pdf.get_y() + 8
    if footer_y > 265:
        pdf.add_page()
        footer_y = 265
    pdf.set_y(270)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(epw, 3,
        _safe(
            f"AI Report | DenseNet121 | {user_id} | {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        ),
        align="C")

    pdf.output(filename)
    return filename