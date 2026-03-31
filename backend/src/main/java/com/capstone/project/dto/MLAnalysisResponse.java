package com.capstone.project.dto;

import java.util.List;
import java.util.Map;

/**
 * Typed DTO matching the flat response from POST /api/v1/analyze-field.
 *
 * The ML service returns a flat JSON object (no "data" wrapper).
 * MLClientService reads it as Map<String, Object>, but this class
 * documents the exact shape for reference.
 *
 * Top-level keys the backend actually uses:
 *   pdf_url      -> plant.reportPdfUrl
 *   prediction   -> plant.health
 *   severity_num -> plant.severity (double)
 *   confidence   -> (available if needed)
 *   heatmap      -> (available if needed)
 */
public class MLAnalysisResponse {

    // Keys read by PlantService
    private String  pdf_url;
    private String  prediction;
    private double  confidence;
    private String  severity;       // "none" | "medium" | "high"
    private double  severity_num;   // 0.0 | 0.5 | 1.0

    // Extra fields returned by ML (not yet consumed by backend)
    private int    row;
    private int    col;
    private String userId;
    private String modelVersion;
    private int    imageCount;
    private Map<String, Object> heatmap;
    private String reportText;
    private List<Map<String, Object>> imageBreakdown;
    private List<Map<String, Object>> results;

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public String getPdf_url()                       { return pdf_url; }
    public void   setPdf_url(String pdf_url)         { this.pdf_url = pdf_url; }

    public String getPrediction()                    { return prediction; }
    public void   setPrediction(String prediction)   { this.prediction = prediction; }

    public double getConfidence()                    { return confidence; }
    public void   setConfidence(double confidence)   { this.confidence = confidence; }

    public String getSeverity()                      { return severity; }
    public void   setSeverity(String severity)       { this.severity = severity; }

    public double getSeverity_num()                  { return severity_num; }
    public void   setSeverity_num(double n)          { this.severity_num = n; }

    public int    getRow()                           { return row; }
    public void   setRow(int row)                    { this.row = row; }

    public int    getCol()                           { return col; }
    public void   setCol(int col)                    { this.col = col; }

    public String getUserId()                        { return userId; }
    public void   setUserId(String userId)           { this.userId = userId; }

    public String getModelVersion()                  { return modelVersion; }
    public void   setModelVersion(String v)          { this.modelVersion = v; }

    public int    getImageCount()                    { return imageCount; }
    public void   setImageCount(int imageCount)      { this.imageCount = imageCount; }

    public Map<String, Object> getHeatmap()          { return heatmap; }
    public void setHeatmap(Map<String, Object> h)    { this.heatmap = h; }

    public String getReportText()                    { return reportText; }
    public void   setReportText(String t)            { this.reportText = t; }

    public List<Map<String, Object>> getImageBreakdown()       { return imageBreakdown; }
    public void setImageBreakdown(List<Map<String, Object>> b) { this.imageBreakdown = b; }

    public List<Map<String, Object>> getResults()              { return results; }
    public void setResults(List<Map<String, Object>> r)        { this.results = r; }
}
