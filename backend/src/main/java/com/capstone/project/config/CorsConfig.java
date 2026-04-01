package com.capstone.project.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

/**
 * CORS configuration.
 *
 * Allowed origins are driven entirely by environment variables so the same
 * image works in every environment without code changes:
 *
 *   Dev (default): http://localhost:5173, http://localhost:3000
 *   Prod:          set CORS_ALLOWED_ORIGINS=https://harvest-box-chi.vercel.app
 *                  in Render's environment variables panel.
 *
 * If you add preview deployments on Vercel, also add their URLs here or
 * use a wildcard origin pattern (requires allowCredentials=false).
 *
 * Why exposedHeaders includes "Authorization":
 *   Some frontend JWT refresh flows read the token from the response
 *   Authorization header. Without this the browser hides it.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                // Explicit list — never use "*" with allowCredentials=true
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                // Expose headers the frontend JavaScript may need to read
                .exposedHeaders("Authorization", "X-Rate-Limit-Remaining", "Retry-After")
                // Required for cookies / Authorization header in cross-origin requests
                .allowCredentials(true)
                // Browser caches preflight for 1 hour — reduces OPTIONS round-trips
                .maxAge(3600);
    }
}