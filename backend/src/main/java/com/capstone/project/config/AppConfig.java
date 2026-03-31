package com.capstone.project.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.web.client.RestTemplate;

/**
 * General application beans:
 * - RestTemplate for ML service calls
 * - Enables Spring Cache
 * - Enables async execution (for email sending etc.)
 */
@Configuration
@EnableCaching
@EnableAsync
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
