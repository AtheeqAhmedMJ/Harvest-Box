# ═══════════════════════════════════════════════════════════════
# Stage 1 — Dependency cache
# Uses the official Maven image instead of the Maven wrapper so
# the build works even if .mvn/ was never committed to git.
# ═══════════════════════════════════════════════════════════════
FROM maven:3.9-eclipse-temurin-21-alpine AS deps
WORKDIR /app

# Copy pom first — deps layer only re-downloads when pom changes
COPY pom.xml ./
RUN mvn dependency:go-offline --no-transfer-progress -q


# ═══════════════════════════════════════════════════════════════
# Stage 2 — Build
# ═══════════════════════════════════════════════════════════════
FROM deps AS build

COPY src ./src
RUN mvn package -DskipTests --no-transfer-progress -q && \
    java -Djarmode=layertools -jar target/*.jar extract --destination target/extracted


# ═══════════════════════════════════════════════════════════════
# Stage 3 — Runtime (final image shipped to Render)
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:21-jre-alpine AS runtime

RUN apk add --no-cache curl && \
    addgroup -S appgroup && \
    adduser  -S appuser -G appgroup

WORKDIR /app

# Copy layered JAR artifacts (least → most volatile for best cache hits)
COPY --from=build --chown=appuser:appgroup /app/target/extracted/dependencies          ./
COPY --from=build --chown=appuser:appgroup /app/target/extracted/spring-boot-loader    ./
COPY --from=build --chown=appuser:appgroup /app/target/extracted/snapshot-dependencies ./
COPY --from=build --chown=appuser:appgroup /app/target/extracted/application           ./

USER appuser

# JVM tuning for Render free tier (512 MB RAM, 0.1 shared CPU)
ENV JAVA_OPTS="\
  -XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=75.0 \
  -XX:InitialRAMPercentage=50.0 \
  -XX:+UseG1GC \
  -XX:+ExitOnOutOfMemoryError \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/tmp/heapdump.hprof \
  -Djava.security.egd=file:/dev/./urandom \
  -Dspring.profiles.active=prod"

# Render injects PORT; fall back to 8080 for local runs
ENV PORT=8080
EXPOSE ${PORT}

# start-period=90s: free-tier cold-start (JVM + Flyway + Hikari) can take 60-80s
HEALTHCHECK \
  --interval=30s \
  --timeout=10s \
  --start-period=90s \
  --retries=3 \
  CMD curl -fs http://localhost:${PORT}/actuator/health | grep -q '"status":"UP"' || exit 1

# exec so SIGTERM reaches JVM directly → graceful shutdown fires
ENTRYPOINT ["sh", "-c", \
  "exec java ${JAVA_OPTS} \
   -Dserver.port=${PORT} \
   org.springframework.boot.loader.launch.JarLauncher"]