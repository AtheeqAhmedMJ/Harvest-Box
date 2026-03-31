package com.capstone.project.repository;

import com.capstone.project.model.Plant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlantRepository extends JpaRepository<Plant, Long> {

    // Non-paginated (kept for backward compat with UserService summary)
    List<Plant> findByUserId(Long userId);

    // Paginated version used by PlantService
    Page<Plant> findByUserId(Long userId, Pageable pageable);

    long countByUserId(Long userId);

    // Efficient count instead of stream filter
    long countByUserIdAndHealthIgnoreCase(Long userId, String health);
}
