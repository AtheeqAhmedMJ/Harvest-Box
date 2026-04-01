package com.capstone.project.config;

import io.github.bucket4j.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * IP-based rate limiter on auth endpoints using Bucket4j.
 *
 * Auth routes:    10 requests / minute per IP.
 * General routes: 120 requests / minute per IP.
 *
 * CORS preflight (OPTIONS) requests are passed through without consuming
 * a token — browsers send a preflight before every credentialed request,
 * so rate-limiting them causes 429s on the actual request that follows.
 *
 * In production with multiple instances, replace the in-memory maps with
 * a Redis-backed ProxyManager for correctness across pods.
 */
@Component
public class RateLimitFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private final Map<String, Bucket> authBuckets    = new ConcurrentHashMap<>();
    private final Map<String, Bucket> generalBuckets = new ConcurrentHashMap<>();

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest  httpReq = (HttpServletRequest)  req;
        HttpServletResponse httpRes = (HttpServletResponse) res;

        // ── CORS preflight: let it through without consuming a token ────────
        // Browsers send OPTIONS before every credentialed cross-origin request.
        // Blocking them here causes the actual request to fail with a 429.
        if ("OPTIONS".equalsIgnoreCase(httpReq.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        String  ip     = getClientIp(httpReq);
        String  path   = httpReq.getRequestURI();
        boolean isAuth = path.startsWith("/api/v1/auth");

        Bucket bucket = isAuth
                ? authBuckets.computeIfAbsent(ip, k -> buildAuthBucket())
                : generalBuckets.computeIfAbsent(ip, k -> buildGeneralBucket());

        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        if (probe.isConsumed()) {
            httpRes.addHeader("X-Rate-Limit-Remaining",
                    String.valueOf(probe.getRemainingTokens()));
            chain.doFilter(req, res);
        } else {
            long waitSeconds = probe.getNanosToWaitForRefill() / 1_000_000_000L;
            log.warn("Rate limit exceeded for IP={} path={}", ip, path);
            httpRes.setStatus(429);
            httpRes.setContentType(MediaType.APPLICATION_JSON_VALUE);
            httpRes.addHeader("Retry-After", String.valueOf(waitSeconds));
            httpRes.getWriter().write(
                "{\"timestamp\":\"" + Instant.now() + "\","
                + "\"status\":429,"
                + "\"error\":\"Too Many Requests\","
                + "\"message\":\"Rate limit exceeded. Retry in " + waitSeconds + "s.\"}"
            );
        }
    }

    // 10 requests / 60 seconds for auth routes
    private Bucket buildAuthBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.classic(10, Refill.greedy(10, Duration.ofMinutes(1))))
                .build();
    }

    // 120 requests / 60 seconds for general routes
    private Bucket buildGeneralBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.classic(120, Refill.greedy(120, Duration.ofMinutes(1))))
                .build();
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
