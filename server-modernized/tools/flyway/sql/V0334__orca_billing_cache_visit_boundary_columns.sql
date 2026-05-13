ALTER TABLE opendolphin.orca_billing_cache
    ADD COLUMN IF NOT EXISTS acceptance_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS visit_date VARCHAR(16),
    ADD COLUMN IF NOT EXISTS department VARCHAR(128),
    ADD COLUMN IF NOT EXISTS insurance_combination VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_orca_billing_cache_visit_boundary
    ON opendolphin.orca_billing_cache (facility_id, visit_date, acceptance_id, fetched_at DESC);
