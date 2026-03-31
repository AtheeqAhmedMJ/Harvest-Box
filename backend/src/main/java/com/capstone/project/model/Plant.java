package com.capstone.project.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "plant",
    indexes = {
        @Index(name = "idx_plant_user_id",    columnList = "userId"),
        @Index(name = "idx_plant_analyzed_at", columnList = "analyzedAt DESC")
    }
)
public class Plant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    private int rowIndex;
    private int colIndex;

    @Column(length = 2048)
    private String imageUrl;

    @Column(length = 50)
    private String health;

    private double severity;      // 0.0 | 0.5 | 1.0

    /** Hybrid model confidence percentage (0–100). */
    private double confidence;

    /**
     * How the final prediction was produced.
     * Values: "hybrid_geometric_mean" | "local_only"
     */
    @Column(length = 50)
    private String fusionMethod;

    /** Human-readable field / block name supplied by the caller. */
    @Column(length = 255)
    private String fieldName;

    /**
     * Disease-pressure rating derived from current weather at analysis time.
     * Values: "Low" | "Moderate" | "High" | "Unknown"
     */
    @Column(length = 20)
    private String weatherRisk;

    @Column(length = 2048)
    private String reportPdfUrl;

    private LocalDateTime analyzedAt;

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public Long          getId()                             { return id; }

    public Long          getUserId()                         { return userId; }
    public void          setUserId(Long userId)              { this.userId = userId; }

    public int           getRowIndex()                       { return rowIndex; }
    public void          setRowIndex(int rowIndex)           { this.rowIndex = rowIndex; }

    public int           getColIndex()                       { return colIndex; }
    public void          setColIndex(int colIndex)           { this.colIndex = colIndex; }

    public String        getImageUrl()                       { return imageUrl; }
    public void          setImageUrl(String imageUrl)        { this.imageUrl = imageUrl; }

    public String        getHealth()                         { return health; }
    public void          setHealth(String health)            { this.health = health; }

    public double        getSeverity()                       { return severity; }
    public void          setSeverity(double severity)        { this.severity = severity; }

    public double        getConfidence()                     { return confidence; }
    public void          setConfidence(double confidence)    { this.confidence = confidence; }

    public String        getFusionMethod()                   { return fusionMethod; }
    public void          setFusionMethod(String m)           { this.fusionMethod = m; }

    public String        getFieldName()                      { return fieldName; }
    public void          setFieldName(String fieldName)      { this.fieldName = fieldName; }

    public String        getWeatherRisk()                    { return weatherRisk; }
    public void          setWeatherRisk(String weatherRisk)  { this.weatherRisk = weatherRisk; }

    public String        getReportPdfUrl()                   { return reportPdfUrl; }
    public void          setReportPdfUrl(String url)         { this.reportPdfUrl = url; }

    public LocalDateTime getAnalyzedAt()                     { return analyzedAt; }
    public void          setAnalyzedAt(LocalDateTime t)      { this.analyzedAt = t; }
}
