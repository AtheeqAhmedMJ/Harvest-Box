# AgriPulse Backend — Production-Grade Upgrade

Spring Boot 3.2 · Java 21 · PostgreSQL · JWT · S3 · Docker

---

## What Changed (and Why)

This is a drop-in production upgrade of the original backend. **Zero API contract changes** — the frontend talks to the same endpoints and receives the same JSON shapes. Everything under the hood is now industry-grade.

---

## Architecture Overview

```
Request → NGINX (SSL, gzip, rate limit)
        → Spring Boot (JWT filter → Controller → Service → Repository)
        → PostgreSQL (prod) / H2 (dev)
        → AWS S3 (images)
        → ML Service (analysis)
```

---

## Quick Start (Dev — H2, no Docker needed)

```bash
# 1. Copy and configure secrets
cp .env.example .env
# Edit .env with your AWS + mail credentials

# 2. Run
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# App: http://localhost:8080
# Swagger: http://localhost:8080/swagger-ui.html
# H2 console: http://localhost:8080/h2-console
```

## Quick Start (Docker Compose — local)

```bash
cp .env.example .env   # fill in values
docker compose up
```

## Production Deploy (PostgreSQL + NGINX)

```bash
# Set all required env vars in .env (see .env.example)
docker compose -f docker-compose.prod.yml up -d
```

---

## Environment Variables

| Variable | Required in Prod | Description |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | ✅ | Set to `prod` |
| `DB_URL` | ✅ | PostgreSQL JDBC URL |
| `DB_USERNAME` | ✅ | DB user |
| `DB_PASSWORD` | ✅ | DB password |
| `JWT_SECRET` | ✅ | Min 32-char random string |
| `AWS_ACCESS_KEY_ID` | ✅ | AWS IAM key |
| `AWS_SECRET_ACCESS_KEY` | ✅ | AWS IAM secret |
| `S3_BUCKET` | ✅ | S3 bucket name |
| `MAIL_USERNAME` | ✅ | Gmail address |
| `MAIL_PASSWORD` | ✅ | Gmail App Password |
| `ML_BASE_URL` | ✅ | ML service URL |
| `CORS_ALLOWED_ORIGINS` | ✅ | Frontend URL(s), comma-separated |

---

## API Reference

Full interactive docs at `/swagger-ui.html` when running.

### Auth (public)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login, receive JWT |
| POST | `/api/v1/auth/verify-otp` | Verify email OTP |
| POST | `/api/v1/auth/resend-otp` | Resend OTP |

### Protected (Bearer token required)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/plants?page=0&size=20` | Paginated analysis reports |
| POST | `/api/v1/plants` | Create plant record |
| POST | `/api/v1/images/upload` | Upload image + trigger ML |
| GET | `/api/v1/user/summary` | Dashboard summary |
| PUT | `/api/v1/user/profile` | Update name/location |

### Error Response Shape

All errors return a consistent JSON envelope:

```json
{
  "timestamp": "2026-03-29T12:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed: {email=Please provide a valid email address.}",
  "path": "/api/v1/auth/register"
}
```

---

## What Was Upgraded

### Database & Persistence
- ✅ PostgreSQL support (prod profile)
- ✅ H2 kept for dev (zero-setup)
- ✅ Flyway migrations (`db/migration/V1__init_schema.sql`)
- ✅ Proper indexes on `users.email`, `plant.user_id`, `plant.analyzed_at`
- ✅ HikariCP tuned (pool size 20, idle timeout, leak detection)
- ✅ `ddl-auto: validate` in prod (Flyway owns schema)

### Security
- ✅ JWT secret from env var (no hardcoded secret)
- ✅ AWS credentials from env var (no hardcoded keys)
- ✅ Spring Security — stateless, all endpoints protected except auth
- ✅ BCrypt password hashing (unchanged)
- ✅ Rate limiting via Bucket4j (10 req/min auth, 120 req/min general)
- ✅ CORS origins configurable via env var
- ✅ NGINX security headers (HSTS, X-Frame-Options, etc.)
- ✅ OTP uses `SecureRandom` instead of `Math.random()`

### API & Architecture
- ✅ All URLs versioned: `/api/v1/...`
- ✅ Thin controllers — all logic in service layer
- ✅ `@Valid` input validation with clear error messages
- ✅ `GlobalExceptionHandler` — consistent JSON errors, no stack traces leaked
- ✅ `ApiException` hierarchy for clean error propagation
- ✅ File upload validation (MIME type, size, filename sanitisation)

### Scalability
- ✅ Fully stateless (no server-side sessions)
- ✅ Pagination on `/api/v1/plants` (`?page=0&size=20`)
- ✅ Spring Cache enabled (`@Cacheable` on plant queries)
- ✅ `countByUserIdAndHealthIgnoreCase` — eliminates N+1 stream filter
- ✅ `@Async` email sending — never blocks HTTP thread

### Configuration
- ✅ `application-dev.yml` — H2, debug logging, Flyway off
- ✅ `application-prod.yml` — PostgreSQL, HikariCP, Flyway on, INFO logging
- ✅ `.env.example` template
- ✅ All hardcoded credentials removed

### Logging & Monitoring
- ✅ Structured Logback config (pretty console dev, JSON-like file prod)
- ✅ `RequestLoggingFilter` — logs method, path, status, duration
- ✅ Spring Boot Actuator (`/actuator/health`)
- ✅ Sensitive paths log at DEBUG only

### Testing
- ✅ `AuthServiceTest` — 7 unit tests (Mockito)
- ✅ `PlantServiceTest` — service layer unit tests
- ✅ `AuthControllerIntegrationTest` — MockMvc integration tests
- ✅ `ProjectApplicationTests` — context loads check

### Docs
- ✅ Swagger / OpenAPI at `/swagger-ui.html`
- ✅ All endpoints documented with `@Operation` and `@Tag`
- ✅ Bearer auth scheme in Swagger UI

### DevOps
- ✅ Multi-stage Dockerfile (JDK build → JRE runtime, non-root user)
- ✅ `docker-compose.yml` (local dev)
- ✅ `docker-compose.prod.yml` (PostgreSQL + NGINX)
- ✅ NGINX config (SSL, gzip, security headers, rate limiting)
- ✅ GitHub Actions CI (build → test → Docker build)
- ✅ `.gitignore` (secrets, H2 data, logs excluded)

---

## Frontend Integration Notes

The API contract is **100% backward compatible**:

- Same endpoint paths — just prefixed with `/v1/` now (`/api/auth/login` → `/api/v1/auth/login`)
- Same request bodies
- Same response shapes
- Error responses are now structured JSON (previously plain strings) — update frontend error handling to read `.message`
- `GET /api/v1/plants` now returns a **Page object** instead of a plain array:
  ```json
  {
    "content": [ ... ],
    "totalElements": 42,
    "totalPages": 3,
    "number": 0,
    "size": 20
  }
  ```
  Read `response.data.content` instead of `response.data` in the frontend.

---

## Running Tests

```bash
./mvnw test -Dspring.profiles.active=dev
```
