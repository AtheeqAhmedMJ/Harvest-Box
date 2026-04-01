# ═══════════════════════════════════════════════════════════════
# Stage 1 — Dependency cache
# Pulls all Maven deps in isolation so this layer is only
# invalidated when pom.xml changes, not on every source edit.
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:21-jdk-alpine AS deps
WORKDIR /app

COPY mvnw mvnw.cmd pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && \
    ./mvnw dependency:go-offline --no-transfer-progress -q


# ═══════════════════════════════════════════════════════════════
# Stage 2 — Build
# ═══════════════════════════════════════════════════════════════
FROM deps AS build

COPY src ./src
RUN ./mvnw package -DskipTests --no-transfer-progress -q && \
    java -Djarmode=layertools -jar target/*.jar extract --destination target/extracted


# ═══════════════════════════════════════════════════════════════
# Stage 3 — Runtime (final image shipped to Render)
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:21-jre-alpine AS runtime

RUN apk add --no-cache curl && \
    addgroup -S appgroup && \
    adduser  -S appuser -G appgroup

WORKDIR /app

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

# Render injects PORT automatically; fall back to 8080 for local runs.
ENV PORT=8080
EXPOSE ${PORT}

# start-period=90s: free-tier cold-start (JVM + Flyway + Hikari) can take 60-80s
HEALTHCHECK \
  --interval=30s \
  --timeout=10s \
  --start-period=90s \
  --retries=3 \
  CMD curl -fs http://localhost:${PORT}/actuator/health | grep -q '"status":"UP"' || exit 1

# exec replaces the shell so SIGTERM reaches the JVM directly → graceful shutdown
ENTRYPOINT ["sh", "-c", \
  "exec java ${JAVA_OPTS} \
   -Dserver.port=${PORT} \
   org.springframework.boot.loader.launch.JarLauncher"]