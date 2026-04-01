package com.capstone.project.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Stateless JWT security.
 *
 * Key change vs original: OPTIONS requests are explicitly permitted before
 * the JWT filter runs. Without this, Spring Security intercepts CORS
 * preflight requests (which carry no Authorization header) and returns 401,
 * causing every credentialed cross-origin request from the Vercel frontend
 * to fail with a CORS error in the browser — even though CorsConfig is
 * correctly configured.
 *
 * Order of events for a cross-origin POST from harvest-box-chi.vercel.app:
 *   1. Browser sends OPTIONS preflight  → must return 200, no JWT needed
 *   2. Browser sends actual POST        → JWT required
 */
@Configuration
public class SecurityConfig {

    private final AuthFilter authFilter;

    public SecurityConfig(AuthFilter authFilter) {
        this.authFilter = authFilter;
    }

    @Bean
    public AuthenticationEntryPoint customAuthenticationEntryPoint() {
        return (HttpServletRequest request, HttpServletResponse response,
                AuthenticationException authException) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            Map<String, Object> body = new HashMap<>();
            body.put("timestamp", Instant.now().toString());
            body.put("status",    HttpServletResponse.SC_UNAUTHORIZED);
            body.put("error",     "Unauthorized");
            body.put("message",   "Authentication required: " + authException.getMessage());
            body.put("path",      request.getRequestURI());

            response.getWriter().write(new ObjectMapper().writeValueAsString(body));
        };
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            // Stateless API — no session, no CSRF token needed
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Delegate CORS to CorsConfig — do NOT set a custom CorsConfigurationSource
            // here or it will override CorsConfig and ignore the allowed-origins property.
            .cors(cors -> {})

            .exceptionHandling(eh -> eh
                    .authenticationEntryPoint(customAuthenticationEntryPoint()))

            .authorizeHttpRequests(auth -> auth

                // ── CORS preflight ──────────────────────────────────────────
                // OPTIONS carries no Authorization header by design.
                // Must be permitted before the JWT filter runs, otherwise
                // Spring Security returns 401 and the browser never sends
                // the actual request (visible as a CORS error in DevTools).
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ── Public auth endpoints ───────────────────────────────────
                .requestMatchers(HttpMethod.POST,
                    "/api/v1/auth/register",
                    "/api/v1/auth/login",
                    "/api/v1/auth/verify-otp",
                    "/api/v1/auth/resend-otp"
                ).permitAll()

                // ── Dev / ops tools ─────────────────────────────────────────
                .requestMatchers(
                    "/h2-console/**",
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/api-docs/**",
                    "/actuator/health"
                ).permitAll()

                // ── Everything else requires a valid JWT ────────────────────
                .anyRequest().authenticated()
            )

            .addFilterBefore(authFilter, UsernamePasswordAuthenticationFilter.class);

        // Allow H2 console iframes in dev (no-op in prod since H2 is not enabled)
        http.headers(h -> h.frameOptions(fo -> fo.sameOrigin()));

        return http.build();
    }
}
