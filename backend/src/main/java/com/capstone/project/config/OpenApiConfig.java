package com.capstone.project.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger / OpenAPI config.
 * Access at: http://localhost:8080/swagger-ui.html
 */
@Configuration
@OpenAPIDefinition(info = @Info(
        title       = "AgriPulse API",
        version     = "v1",
        description = "Crop Health Monitoring Backend"
))
@SecurityScheme(
        name   = "bearerAuth",
        type   = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        in     = SecuritySchemeIn.HEADER
)
public class OpenApiConfig {
}
