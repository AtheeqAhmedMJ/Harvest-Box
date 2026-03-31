package com.capstone.project.dto;

/**
 * API response DTO for a plant/field analysis record.
 *
 * v2 additions (hybrid ML service):
 *   - confidence     : hybrid model confidence percentage
 *   - fusionMethod   : "hybrid_geometric_mean" | "local_only"
 *   - fieldName      : human-readable field / block name
 *   - weatherRisk    : "Low" | "Moderate" | "High" | "Unknown"
 *   - severityLabel  : string label derived from numeric severity
 */
public class PlantResponse {

    public Long   id;
    public int    rowIndex;
    public int    colIndex;
    public String health;
    public double severity;        // 0.0 = none, 0.5 = medium, 1.0 = high
    public String severityLabel;   // "None" | "Medium" | "High"
    public double confidence;      // 0–100 percentage
    public String fusionMethod;    // "hybrid_geometric_mean" | "local_only"
    public String fieldName;       // e.g. "North Block"
    public String weatherRisk;     // "Low" | "Moderate" | "High" | "Unknown"
    public String reportPdfUrl;
    public String analyzedAt;      // ISO-8601, timezone-safe
}
