package com.capstone.project.service;

import com.capstone.project.dto.PlantResponse;
import com.capstone.project.model.Plant;
import com.capstone.project.repository.PlantRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PlantService Unit Tests")
class PlantServiceTest {

    @Mock PlantRepository     plantRepository;
    @Mock ImageStorageService storageService;
    @Mock MLClientService     mlClientService;

    @InjectMocks PlantService plantService;

    @Test
    @DisplayName("getReports: returns page mapped to DTOs")
    void getReports_returnsMappedPage() {
        Plant plant = samplePlant(1L, 1L);
        Page<Plant> page = new PageImpl<>(List.of(plant));

        when(plantRepository.findByUserId(eq(1L), any(Pageable.class))).thenReturn(page);

        Page<PlantResponse> result = plantService.getReports(1L, 0, 20);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).rowIndex).isEqualTo(2);
        assertThat(result.getContent().get(0).colIndex).isEqualTo(3);
        assertThat(result.getContent().get(0).health).isEqualTo("ANALYZED");
    }

    @Test
    @DisplayName("create: sets userId from auth context, not request body")
    void create_forcesSetsUserId() {
        Plant plant = new Plant();
        plant.setRowIndex(1);
        plant.setColIndex(1);
        plant.setAnalyzedAt(LocalDateTime.now());

        when(plantRepository.save(any(Plant.class))).thenAnswer(inv -> inv.getArgument(0));

        PlantResponse result = plantService.create(plant, 99L);

        assertThat(plant.getUserId()).isEqualTo(99L);
    }

    // ── helpers ───────────────────────────────────────────────

    private Plant samplePlant(Long id, Long userId) {
        Plant p = new Plant();
        p.setUserId(userId);
        p.setRowIndex(2);
        p.setColIndex(3);
        p.setHealth("ANALYZED");
        p.setAnalyzedAt(LocalDateTime.now());
        return p;
    }
}
