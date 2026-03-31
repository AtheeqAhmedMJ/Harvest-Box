package com.capstone.project.service;

import com.capstone.project.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * ML service client.
 *
 * v2: added {@link #analyzeFieldWithPayload(Map)} so PlantService can pass
 * optional enrichment fields (field_name, lat, lon) through to the ML service
 * without the method signature exploding with parameters.
 *
 * The original {@link #analyzeField(int, int, List, String)} is kept for
 * backward compatibility (tests, manual calls).
 */
@Service
public class MLClientService {

    private static final Logger log = LoggerFactory.getLogger(MLClientService.class);

    private final RestTemplate restTemplate;

    @Value("${ml.base-url:http://localhost:8000}")
    private String mlBaseUrl;

    public MLClientService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Simple variant — constructs a minimal payload internally.
     * Kept for backward compatibility.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeField(int row, int col, List<String> imageUrls, String userId) {
        Map<String, Object> payload = Map.of(
                "row",        row,
                "col",        col,
                "image_urls", imageUrls,
                "user_id",    userId
        );
        return analyzeFieldWithPayload(payload);
    }

    /**
     * Full variant — accepts a pre-built payload map.
     * Supports optional keys: field_name, lat, lon.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeFieldWithPayload(Map<String, Object> payload) {
        String url = mlBaseUrl + "/api/v1/analyze-field";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

        int row = payload.get("row") instanceof Number n ? n.intValue() : -1;
        int col = payload.get("col") instanceof Number n ? n.intValue() : -1;

        try {
            log.info("Calling ML service: row={} col={}", row, col);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            log.info("ML service response status: {}", response.getStatusCode());
            return response.getBody();

        } catch (HttpClientErrorException e) {
            String detail = extractMLErrorDetail(e);
            log.error("ML service client error [{}]: {}", e.getStatusCode(), detail);
            if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                throw ApiException.unprocessableEntity("Image analysis failed: " + detail);
            } else if (e.getStatusCode() == HttpStatus.BAD_REQUEST) {
                throw ApiException.badRequest("Invalid request to analysis service: " + detail);
            }
            throw ApiException.badRequest("Analysis service rejected the request: " + detail);

        } catch (HttpServerErrorException e) {
            log.error("ML service server error [{}]: {}", e.getStatusCode(), e.getMessage());
            throw ApiException.internalServerError(
                    "Analysis service is temporarily unavailable. Please try again later.");

        } catch (RestClientException e) {
            log.error("ML service connection failed: {}", e.getMessage());
            throw ApiException.internalServerError(
                    "Cannot reach analysis service. Please check your connection and try again.");
        }
    }

    private String extractMLErrorDetail(HttpClientErrorException ex) {
        try {
            String body = ex.getResponseBodyAsString();
            if (body != null && !body.isBlank()) {
                if (body.contains("\"detail\"")) {
                    int start = body.indexOf("\"detail\"") + 10;
                    int end   = body.indexOf("\"", start);
                    if (end > start) return body.substring(start, end);
                }
                return body.length() > 150 ? body.substring(0, 150) : body;
            }
        } catch (Exception e) {
            log.debug("Failed to parse ML error response: {}", e.getMessage());
        }
        return "Unknown error from analysis service";
    }
}
