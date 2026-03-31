package com.capstone.project.controller;

import com.capstone.project.dto.PlantResponse;
import com.capstone.project.model.Plant;
import com.capstone.project.service.PlantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/plants")
@Tag(name = "Plants", description = "Field analysis reports")
@SecurityRequirement(name = "bearerAuth")
public class PlantController {

    private final PlantService plantService;

    public PlantController(PlantService plantService) {
        this.plantService = plantService;
    }

    @Operation(summary = "Get paginated list of reports for current user")
    @GetMapping
    public ResponseEntity<Page<PlantResponse>> getAllReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(plantService.getReports(userId, page, size));
    }

    @Operation(summary = "Manually create a plant record")
    @PostMapping
    public ResponseEntity<PlantResponse> createPlant(
            @RequestBody Plant plant,
            Authentication auth
    ) {
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(plantService.create(plant, userId));
    }
}