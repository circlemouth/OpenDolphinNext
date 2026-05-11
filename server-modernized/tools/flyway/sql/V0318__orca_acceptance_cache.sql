CREATE TABLE IF NOT EXISTS opendolphin.orca_acceptance_cache (
    orca_acceptance_cache_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    orca_acceptance_key VARCHAR(128) NOT NULL,
    orca_acceptance_id VARCHAR(128),
    orca_patient_id VARCHAR(64),
    acceptance_date VARCHAR(16) NOT NULL,
    acceptance_time VARCHAR(16),
    department_code VARCHAR(64),
    physician_code VARCHAR(64),
    medical_information VARCHAR(64),
    insurance_combination_number VARCHAR(64),
    source_system VARCHAR(32) NOT NULL DEFAULT 'ORCA',
    source_api VARCHAR(64) NOT NULL DEFAULT 'acceptlstv2',
    source_request_id VARCHAR(128),
    source_trace_id VARCHAR(128),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cache_expires_at TIMESTAMPTZ,
    acceptance_status VARCHAR(32) NOT NULL,
    event_type VARCHAR(64),
    cancelled_at TIMESTAMPTZ,
    row_hash VARCHAR(64) NOT NULL,
    normalized_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_acceptance_cache_source CHECK (source_system = 'ORCA'),
    CONSTRAINT ck_orca_acceptance_cache_status CHECK (acceptance_status IN (
        'CURRENT',
        'DIFF_DETECTED',
        'CANCELLED',
        'NEEDS_REVIEW',
        'UNAVAILABLE'
    )),
    CONSTRAINT ck_orca_acceptance_cache_event CHECK (
        event_type IS NULL OR event_type IN (
            'ORCA_ACCEPTANCE_FETCHED',
            'ORCA_ACCEPTANCE_DIFF_DETECTED',
            'ORCA_ACCEPTANCE_CANCELLED',
            'ORCA_ACCEPTANCE_NEEDS_REVIEW'
        )
    ),
    CONSTRAINT uk_orca_acceptance_cache_context UNIQUE (facility_id, acceptance_date, orca_acceptance_key)
);

CREATE INDEX IF NOT EXISTS idx_orca_acceptance_cache_patient
    ON opendolphin.orca_acceptance_cache (facility_id, orca_patient_id, acceptance_date DESC);

CREATE INDEX IF NOT EXISTS idx_orca_acceptance_cache_status
    ON opendolphin.orca_acceptance_cache (facility_id, acceptance_date, acceptance_status);
