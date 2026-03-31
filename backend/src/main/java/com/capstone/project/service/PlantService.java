package com.capstone.project.service;

import com.capstone.project.dto.PlantResponse;
import com.capstone.project.exception.ApiException;
import com.capstone.project.model.Plant;
import com.capstone.project.repository.PlantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/**
 * Plant / field analysis service layer.
 *
 * v2 changes:
 *   - Passes optional fieldName, lat, lon to the ML service so the
 *     report and PDF include field context and accurate weather.
 *   - Reads confidence, fusionMethod, weatherRisk from the ML response.
 *   - Maps those new fields onto the Plant entity and PlantResponse DTO.
 */
@Service
public class PlantService {

    private static final Logger log = LoggerFactory.getLogger(PlantService.class);

    private final PlantRepository     plantRepository;
    private final ImageStorageService storageService;
    private final MLClientService     mlClientService;

    public PlantService(PlantRepository plantRepository,
                        ImageStorageService storageService,
                        MLClientService mlClientService) {
        this.plantRepository = plantRepository;
        this.storageService  = storageService;
        this.mlClientService = mlClientService;
    }

    /**
     * Upload image → store in S3 → call hybrid ML service → persist result.
     *
     * @param file       the image file to analyse
     * @param row        grid row index
     * @param col        grid column index
     * @param userId     authenticated user ID
     * @param fieldName  optional human-readable field name (e.g. "North Block")
     * @param lat        optional field latitude for weather lookup
     * @param lon        optional field longitude for weather lookup
     */
    @Transactional
    @CacheEvict(value = "plantsByUser", allEntries = true)
    public PlantResponse uploadAndAnalyze(
            MultipartFile file,
            int row, int col,
            Long userId,
            String fieldName,
            Double lat,
            Double lon
    ) throws Exception {

        String imageUrl = storageService.save(file, userId);

        // Build payload — include optional enrichment fields
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("row",        row);
        payload.put("col",        col);
        payload.put("image_urls", List.of(imageUrl));
        payload.put("user_id",    userId.toString());
        if (fieldName != null && !fieldName.isBlank()) payload.put("field_name", fieldName);
        if (lat != null)  payload.put("lat", lat);
        if (lon != null)  payload.put("lon", lon);

        Map<String, Object> ml = mlClientService.analyzeFieldWithPayload(payload);

        // ── Read core fields ──────────────────────────────────────────────
        String pdfUrl      = (String) ml.get("pdf_url");
        String prediction  = (String) ml.getOrDefault("prediction", "UNKNOWN");
        double severityNum = toDouble(ml.getOrDefault("severity_num", 0.0));
        double confidence  = toDouble(ml.getOrDefault("confidence",   0.0));

        // ── Read new hybrid fields ────────────────────────────────────────
        String fusionMethod = (String) ml.getOrDefault("fusionMethod", "local_only");
        String weatherRisk  = extractWeatherRisk(ml);

        // ── Persist ───────────────────────────────────────────────────────
        Plant plant = new Plant();
        plant.setUserId(userId);
        plant.setRowIndex(row);
        plant.setColIndex(col);
        plant.setImageUrl(imageUrl);
        plant.setHealth(prediction);
        plant.setSeverity(severityNum);
        plant.setConfidence(confidence);
        plant.setFusionMethod(fusionMethod);
        plant.setFieldName(fieldName != null ? fieldName : "");
        plant.setWeatherRisk(weatherRisk);
        plant.setReportPdfUrl(pdfUrl);
        plant.setAnalyzedAt(LocalDateTime.now());

        plantRepository.save(plant);
        log.info("Plant analysis saved: userId={} row={} col={} prediction={} confidence={}% fusion={}",
                userId, row, col, prediction, confidence, fusionMethod);

        return toResponse(plant);
    }

    /** Paginated list of reports for a user. */
    @Cacheable(value = "plantsByUser", key = "#userId + '-' + #page + '-' + #size")
    public Page<PlantResponse> getReports(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("analyzedAt").descending());
        return plantRepository.findByUserId(userId, pageable)
                .map(this::toResponse);
    }

    /** Create a plant record manually. */
    @Transactional
    @CacheEvict(value = "plantsByUser", allEntries = true)
    public PlantResponse create(Plant plant, Long userId) {
        plant.setUserId(userId);
        return toResponse(plantRepository.save(plant));
    }

    // ── Entity → DTO ──────────────────────────────────────────────────────────

    public PlantResponse toResponse(Plant plant) {
        PlantResponse dto = new PlantResponse();
        dto.id            = plant.getId();
        dto.rowIndex      = plant.getRowIndex();
        dto.colIndex      = plant.getColIndex();
        dto.health        = plant.getHealth();
        dto.severity      = plant.getSeverity();
        dto.severityLabel = severityLabel(plant.getSeverity());
        dto.confidence    = plant.getConfidence();
        dto.fusionMethod  = plant.getFusionMethod() != null ? plant.getFusionMethod() : "local_only";
        dto.fieldName     = plant.getFieldName()    != null ? plant.getFieldName()    : "";
        dto.weatherRisk   = plant.getWeatherRisk()  != null ? plant.getWeatherRisk()  : "Unknown";
        dto.reportPdfUrl  = plant.getReportPdfUrl();
        dto.analyzedAt    = plant.getAnalyzedAt() != null
                ? plant.getAnalyzedAt().atZone(ZoneId.systemDefault()).toInstant().toString()
                : null;
        return dto;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private double toDouble(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(value.toString()); }
        catch (Exception e) { return 0.0; }
    }

    private String severityLabel(double severity) {
        if (severity >= 0.9) return "High";
        if (severity >= 0.4) return "Medium";
        return "None";
    }

    @SuppressWarnings("unchecked")
    private String extractWeatherRisk(Map<String, Object> ml) {
        try {
            Object weatherObj = ml.get("weather");
            if (weatherObj instanceof Map<?, ?> weatherMap) {
                Object risk = weatherMap.get("disease_risk");
                if (risk instanceof String s) return s;
            }
        } catch (Exception ignored) {}
        return "Unknown";
    }
}
