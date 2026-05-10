CREATE TABLE IF NOT EXISTS opendolphin.orca_insurance_cache (
    orca_insurance_cache_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    orca_patient_id VARCHAR(64) NOT NULL,
    base_date VARCHAR(16) NOT NULL,
    insurance_combination_number VARCHAR(64) NOT NULL,
    insurance_provider_class VARCHAR(64),
    insurance_provider_name VARCHAR(256),
    rate_admission VARCHAR(32),
    rate_outpatient VARCHAR(32),
    certificate_start_date VARCHAR(16),
    certificate_expired_date VARCHAR(16),
    public_insurance_count INTEGER NOT NULL DEFAULT 0,
    source_system VARCHAR(32) NOT NULL DEFAULT 'ORCA',
    source_api VARCHAR(64) NOT NULL DEFAULT 'insuranceinf1v2',
    source_request_id VARCHAR(128),
    source_trace_id VARCHAR(128),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cache_expires_at TIMESTAMPTZ,
    cache_status VARCHAR(32) NOT NULL,
    row_hash VARCHAR(64) NOT NULL,
    normalized_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_insurance_cache_source CHECK (source_system = 'ORCA'),
    CONSTRAINT ck_orca_insurance_cache_status CHECK (cache_status IN (
        'CURRENT',
        'DIFF_DETECTED',
        'NEEDS_REVIEW',
        'UNAVAILABLE'
    )),
    CONSTRAINT uk_orca_insurance_cache_context UNIQUE (
        facility_id,
        orca_patient_id,
        base_date,
        insurance_combination_number
    )
);

CREATE INDEX IF NOT EXISTS idx_orca_insurance_cache_patient
    ON opendolphin.orca_insurance_cache (facility_id, orca_patient_id, base_date DESC);

ALTER TABLE opendolphin.encounter_insurance_snapshot
    ADD COLUMN IF NOT EXISTS facility_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS chart_revision_id BIGINT,
    ADD COLUMN IF NOT EXISTS orca_patient_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS acceptance_date VARCHAR(16),
    ADD COLUMN IF NOT EXISTS orca_acceptance_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS department_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS physician_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS insurance_combination_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_cache_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_system VARCHAR(32) DEFAULT 'ORCA',
    ADD COLUMN IF NOT EXISTS snapshot_reason VARCHAR(64) DEFAULT 'CHART_CONTEXT',
    ADD COLUMN IF NOT EXISTS snapshot_created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS response_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE opendolphin.encounter_insurance_snapshot
    ADD CONSTRAINT ck_encounter_insurance_snapshot_source
        CHECK (source_system IS NULL OR source_system = 'ORCA');

ALTER TABLE opendolphin.encounter_insurance_snapshot
    ADD CONSTRAINT ck_encounter_insurance_snapshot_reason
        CHECK (snapshot_reason IS NULL OR snapshot_reason IN (
            'CHART_CONTEXT',
            'FINALIZE',
            'ORCA_SEND_PREPARE',
            'RESEND_REVIEW'
        ));

CREATE INDEX IF NOT EXISTS idx_encounter_insurance_snapshot_context
    ON opendolphin.encounter_insurance_snapshot (facility_id, encounter_key, snapshot_created_at DESC);
