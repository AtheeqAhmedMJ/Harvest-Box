package com.capstone.project.service;

import com.capstone.project.exception.ApiException;
import com.capstone.project.model.User;
import com.capstone.project.repository.PlantRepository;
import com.capstone.project.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * User profile business logic extracted from UserController.
 */
@Service
public class UserService {

    private final UserRepository  userRepository;
    private final PlantRepository plantRepository;

    public UserService(UserRepository userRepository, PlantRepository plantRepository) {
        this.userRepository  = userRepository;
        this.plantRepository = plantRepository;
    }

    public Map<String, Object> getSummary(Long userId) {
        User user = findById(userId);

        long totalReports = plantRepository.countByUserId(userId);
        long healthy = plantRepository.countByUserIdAndHealthIgnoreCase(userId, "healthy");
        long warnings = totalReports - healthy;

        return Map.of(
            "id",               user.getId(),
            "name",             user.getName(),
            "email",            user.getEmail(),
            "location",         user.getLocation() != null ? user.getLocation() : "",
            "reportsGenerated", totalReports,
            "healthyFields",    healthy,
            "warnings",         warnings
        );
    }

    @Transactional
    public Map<String, Object> updateProfile(Long userId, Map<String, String> body) {
        User user = findById(userId);

        if (body.containsKey("name")     && !body.get("name").isBlank())
            user.setName(body.get("name").trim());
        if (body.containsKey("location"))
            user.setLocation(body.get("location").trim());

        userRepository.save(user);

        return Map.of(
            "id",       user.getId(),
            "name",     user.getName(),
            "email",    user.getEmail(),
            "location", user.getLocation() != null ? user.getLocation() : ""
        );
    }

    private User findById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found."));
    }
}
