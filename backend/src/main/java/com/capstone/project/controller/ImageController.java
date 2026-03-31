package com.capstone.project.controller;

import com.capstone.project.dto.PlantResponse;
import com.capstone.project.service.PlantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Image upload + analysis controller.
 *
 * v2: added optional fieldName, lat, lon request parameters so the frontend
 * can supply field context and GPS coordinates for accurate weather lookup.
 * All three are backward-compatible (optional with safe defaults).
 */
@RestController
@RequestMapping("/api/v1/images")
@Tag(name = "Images", description = "Upload field images for analysis")
@SecurityRequirement(name = "bearerAuth")
public class ImageController {

    private final PlantService plantService;

    public ImageController(PlantService plantService) {
        this.plantService = plantService;
    }

    @Operation(summary = "Upload an image and trigger hybrid ML analysis")
    @PostMapping("/upload")
    public ResponseEntity<PlantResponse> uploadImage(
            @RequestParam("file")  MultipartFile file,
            @RequestParam("row")   int row,
            @RequestParam("col")   int col,
            @Parameter(description = "Human-readable field/block name, e.g. 'North Block'")
            @RequestParam(value = "fieldName", required = false, defaultValue = "") String fieldName,
            @Parameter(description = "Field latitude for accurate weather (optional)")
            @RequestParam(value = "lat", required = false) Double lat,
            @Parameter(description = "Field longitude for accurate weather (optional)")
            @RequestParam(value = "lon", required = false) Double lon,
            Authentication auth
    ) throws Exception {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(
                plantService.uploadAndAnalyze(file, row, col, userId, fieldName, lat, lon)
        );
    }
}
