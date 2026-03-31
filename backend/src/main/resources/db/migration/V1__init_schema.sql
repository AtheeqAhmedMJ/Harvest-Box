-- ─── V1: Initial Schema (mirrors existing H2 schema) ───────────
-- Safe to run on a fresh PostgreSQL database.
-- Flyway tracks this version — it will never run twice.

CREATE TABLE IF NOT EXISTS users (
    id             BIGSERIAL PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    name           VARCHAR(255) NOT NULL,
    location       VARCHAR(255) DEFAULT '',
    verified       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS verification_tokens (
    id          BIGSERIAL PRIMARY KEY,
    otp         VARCHAR(10)  NOT NULL,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiry_date TIMESTAMP    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vt_user_id ON verification_tokens(user_id);

CREATE TABLE IF NOT EXISTS plant (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    row_index      INT           NOT NULL,
    col_index      INT           NOT NULL,
    image_url      TEXT,
    health         VARCHAR(50),
    severity       DOUBLE PRECISION DEFAULT 0.0,
    report_pdf_url TEXT,
    analyzed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plant_user_id ON plant(user_id);
CREATE INDEX IF NOT EXISTS idx_plant_analyzed_at ON plant(analyzed_at DESC);
