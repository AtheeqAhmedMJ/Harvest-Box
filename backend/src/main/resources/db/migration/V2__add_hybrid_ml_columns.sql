-- ─── V2: Hybrid ML enrichment columns ───────────────────────────────────────
-- Adds columns to store richer data returned by the hybrid ML service (v3).
-- All columns are nullable so existing rows are unaffected.

ALTER TABLE plant
    ADD COLUMN IF NOT EXISTS confidence    DOUBLE PRECISION DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS fusion_method VARCHAR(50)      DEFAULT 'local_only',
    ADD COLUMN IF NOT EXISTS field_name    VARCHAR(255)     DEFAULT '',
    ADD COLUMN IF NOT EXISTS weather_risk  VARCHAR(20)      DEFAULT 'Unknown';

COMMENT ON COLUMN plant.confidence    IS 'Hybrid model confidence 0-100';
COMMENT ON COLUMN plant.fusion_method IS 'hybrid_geometric_mean | local_only';
COMMENT ON COLUMN plant.field_name    IS 'Human-readable field / block name';
COMMENT ON COLUMN plant.weather_risk  IS 'Low | Moderate | High | Unknown';
