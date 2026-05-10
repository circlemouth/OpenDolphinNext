CREATE TABLE IF NOT EXISTS opendolphin.orca_disease_cache (
    orca_disease_cache_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    orca_patient_id VARCHAR(64) NOT NULL,
    base_month VARCHAR(6) NOT NULL,
    perform_date DATE,
    department_code VARCHAR(32),
    insurance_combination_number VARCHAR(32),
    source_system VARCHAR(32) NOT NULL DEFAULT 'ORCA',
    source_api VARCHAR(64) NOT NULL DEFAULT 'diseasegetv2',
    source_request_id VARCHAR(128),
    source_trace_id VARCHAR(128),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cache_expires_at TIMESTAMPTZ,
    raw_response_hash VARCHAR(64) NOT NULL,
    normalized_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    unmatched_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_disease_cache_source CHECK (source_system = 'ORCA'),
    CONSTRAINT uk_orca_disease_cache_context UNIQUE (
        facility_id,
        orca_patient_id,
        base_month,
        department_code,
        insurance_combination_number
    )
);

CREATE INDEX IF NOT EXISTS idx_orca_disease_cache_patient
    ON opendolphin.orca_disease_cache (facility_id, orca_patient_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.orca_disease_snapshot (
    orca_disease_snapshot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    encounter_id VARCHAR(128),
    chart_revision_id VARCHAR(128),
    orca_patient_id VARCHAR(64) NOT NULL,
    base_month VARCHAR(6),
    perform_date DATE,
    department_code VARCHAR(32),
    physician_code VARCHAR(32),
    insurance_combination_number VARCHAR(32),
    snapshot_reason VARCHAR(64) NOT NULL,
    snapshot_created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_api VARCHAR(64) NOT NULL DEFAULT 'diseasegetv2',
    source_request_id VARCHAR(128),
    source_trace_id VARCHAR(128),
    cache_id BIGINT REFERENCES opendolphin.orca_disease_cache(orca_disease_cache_id) ON DELETE SET NULL,
    raw_response_hash VARCHAR(64),
    normalized_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    unmatched_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_disease_snapshot_reason CHECK (snapshot_reason IN (
        'CHART_FINALIZE',
        'ORCA_SEND_PRECHECK',
        'ORCA_SEND_RESULT',
        'RECONCILIATION',
        'EXPORT'
    ))
);

CREATE INDEX IF NOT EXISTS idx_orca_disease_snapshot_encounter
    ON opendolphin.orca_disease_snapshot (facility_id, encounter_id, snapshot_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_disease_snapshot_patient
    ON opendolphin.orca_disease_snapshot (facility_id, orca_patient_id, snapshot_created_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.orca_disease_operation (
    orca_disease_operation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    operation_type VARCHAR(32) NOT NULL,
    operation_status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    requested_by VARCHAR(128) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    orca_patient_id VARCHAR(64) NOT NULL,
    encounter_id VARCHAR(128),
    chart_revision_id VARCHAR(128),
    perform_date DATE,
    department_code VARCHAR(32),
    physician_code VARCHAR(32),
    insurance_combination_number VARCHAR(32),
    request_hash VARCHAR(64) NOT NULL,
    response_hash VARCHAR(64),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error_code VARCHAR(128),
    needs_user_review BOOLEAN NOT NULL DEFAULT FALSE,
    warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    unmatched_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    request_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uk_orca_disease_operation_idempotency UNIQUE (facility_id, idempotency_key),
    CONSTRAINT ck_orca_disease_operation_type CHECK (operation_type IN (
        'CREATE',
        'UPDATE',
        'DELETE',
        'ORGANIZE_DELETED_DISEASES',
        'FETCH'
    )),
    CONSTRAINT ck_orca_disease_operation_status CHECK (operation_status IN (
        'PREPARED',
        'READY_TO_SEND',
        'SENDING',
        'ORCA_ACCEPTED',
        'ORCA_REJECTED',
        'ORCA_WARNING',
        'ORCA_UNMATCHED',
        'ORCA_CONFLICT',
        'NETWORK_FAILED',
        'CERTIFICATE_FAILED',
        'AUTH_FAILED',
        'UNKNOWN',
        'NEEDS_REVIEW',
        'CANCELLED'
    )),
    CONSTRAINT ck_orca_disease_operation_retry CHECK (retry_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orca_disease_operation_patient
    ON opendolphin.orca_disease_operation (facility_id, orca_patient_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_disease_operation_status
    ON opendolphin.orca_disease_operation (facility_id, operation_status, requested_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.orca_disease_audit_event (
    orca_disease_audit_event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    actor_user_id VARCHAR(128),
    actor_role VARCHAR(64),
    orca_patient_id VARCHAR(64) NOT NULL,
    encounter_id VARCHAR(128),
    chart_revision_id VARCHAR(128),
    orca_disease_operation_id BIGINT REFERENCES opendolphin.orca_disease_operation(orca_disease_operation_id) ON DELETE SET NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_id VARCHAR(128),
    trace_id VARCHAR(128),
    before_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_status VARCHAR(32) NOT NULL,
    error_code VARCHAR(128),
    warning_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    unmatched_summary_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    previous_hash VARCHAR(64),
    event_hash VARCHAR(64) NOT NULL,
    CONSTRAINT ck_orca_disease_audit_result CHECK (result_status IN (
        'SUCCESS',
        'WARNING',
        'FAILED',
        'UNMATCHED',
        'NEEDS_REVIEW',
        'UNKNOWN'
    ))
);

CREATE INDEX IF NOT EXISTS idx_orca_disease_audit_patient
    ON opendolphin.orca_disease_audit_event (facility_id, orca_patient_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_disease_audit_operation
    ON opendolphin.orca_disease_audit_event (orca_disease_operation_id, occurred_at DESC);
