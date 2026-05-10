CREATE TABLE IF NOT EXISTS opendolphin.orca_patient_cache (
    orca_patient_cache_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    orca_patient_id VARCHAR(64) NOT NULL,
    internal_patient_id BIGINT,
    source_system VARCHAR(32) NOT NULL DEFAULT 'ORCA',
    source_api VARCHAR(64) NOT NULL DEFAULT 'patientgetv2',
    source_request_id VARCHAR(128),
    source_trace_id VARCHAR(128),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cache_expires_at TIMESTAMPTZ,
    cache_status VARCHAR(32) NOT NULL,
    business_status VARCHAR(64) NOT NULL,
    raw_response_hash VARCHAR(64) NOT NULL,
    normalized_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_patient_cache_source CHECK (source_system = 'ORCA'),
    CONSTRAINT ck_orca_patient_cache_status CHECK (cache_status IN (
        'CURRENT',
        'STALE',
        'NOT_FOUND',
        'UNAVAILABLE',
        'NEEDS_REVIEW'
    )),
    CONSTRAINT ck_orca_patient_cache_business_status CHECK (business_status IN (
        'ORCA_PATIENT_FOUND',
        'ORCA_PATIENT_NOT_FOUND',
        'ORCA_PATIENT_WARNING',
        'ORCA_PATIENT_UNMATCHED',
        'ORCA_PATIENT_UNAVAILABLE',
        'ORCA_PATIENT_NEEDS_REVIEW'
    )),
    CONSTRAINT uk_orca_patient_cache_context UNIQUE (facility_id, orca_patient_id)
);

CREATE INDEX IF NOT EXISTS idx_orca_patient_cache_patient
    ON opendolphin.orca_patient_cache (facility_id, orca_patient_id, fetched_at DESC);

