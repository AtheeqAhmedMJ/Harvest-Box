package com.capstone.project.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Weather proxy controller.
 *
 * The frontend calls this endpoint instead of calling OpenWeatherMap directly,
 * keeping the API key securely on the server side.
 *
 * GET /api/v1/weather?lat={lat}&lon={lon}
 * GET /api/v1/weather/forecast?lat={lat}&lon={lon}
 */
@RestController
@RequestMapping("/api/v1/weather")
@Tag(name = "Weather", description = "Proxied weather data — API key stays server-side")
@SecurityRequirement(name = "bearerAuth")
public class WeatherController {

    private static final Logger log = LoggerFactory.getLogger(WeatherController.class);

    private static final String OWM_BASE    = "https://api.openweathermap.org/data/2.5";
    private static final String OWM_CURRENT = OWM_BASE + "/weather?lat={lat}&lon={lon}&units=metric&appid={key}";
    private static final String OWM_FORECAST= OWM_BASE + "/forecast?lat={lat}&lon={lon}&units=metric&appid={key}";

    private final RestTemplate restTemplate;

    @Value("${weather.api-key}")
    private String apiKey;

    public WeatherController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Operation(summary = "Current weather at given coordinates")
    @GetMapping
    public ResponseEntity<Object> currentWeather(
            @RequestParam double lat,
            @RequestParam double lon
    ) {
        try {
            ResponseEntity<Object> resp = restTemplate.getForEntity(
                    OWM_CURRENT, Object.class, lat, lon, apiKey
            );
            return ResponseEntity.ok(resp.getBody());
        } catch (Exception e) {
            log.error("Weather current fetch failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Weather service unavailable", "detail", e.getMessage()));
        }
    }

    @Operation(summary = "5-day / 3-hour weather forecast at given coordinates")
    @GetMapping("/forecast")
    public ResponseEntity<Object> forecastWeather(
            @RequestParam double lat,
            @RequestParam double lon
    ) {
        try {
            ResponseEntity<Object> resp = restTemplate.getForEntity(
                    OWM_FORECAST, Object.class, lat, lon, apiKey
            );
            return ResponseEntity.ok(resp.getBody());
        } catch (Exception e) {
            log.error("Weather forecast fetch failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Forecast service unavailable", "detail", e.getMessage()));
        }
    }
}
