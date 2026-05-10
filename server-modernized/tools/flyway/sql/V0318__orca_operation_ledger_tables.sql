CREATE TABLE IF NOT EXISTS opendolphin.orca_operation (
    orca_operation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    operation_scope VARCHAR(32) NOT NULL,
    operation_type VARCHAR(64) NOT NULL,
    source_api VARCHAR(64) NOT NULL,
    operation_status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    requested_by VARCHAR(128) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ready_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    orca_patient_id VARCHAR(64),
    encounter_key VARCHAR(128),
    chart_revision_id VARCHAR(128),
    prescription_order_id BIGINT,
    perform_date DATE,
    department_code VARCHAR(32),
    physician_code VARCHAR(32),
    insurance_combination_number VARCHAR(32),
    request_hash VARCHAR(64) NOT NULL,
    response_hash VARCHAR(64),
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    last_error_code VARCHAR(128),
    needs_user_review BOOLEAN NOT NULL DEFAULT FALSE,
    request_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_orca_operation_idempotency UNIQUE (facility_id, source_api, idempotency_key),
    CONSTRAINT ck_orca_operation_scope CHECK (operation_scope IN (
        'PATIENT',
        'ACCEPTANCE',
        'INSURANCE',
        'DISEASE',
        'MEDICAL',
        'BILLING',
        'INCOME',
        'REPORT',
        'SYSTEM'
    )),
    CONSTRAINT ck_orca_operation_status CHECK (operation_status IN (
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
    CONSTRAINT ck_orca_operation_retry CHECK (retry_count >= 0),
    CONSTRAINT ck_orca_operation_request_hash CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_orca_operation_response_hash CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_orca_operation_patient
    ON opendolphin.orca_operation (facility_id, orca_patient_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_operation_encounter
    ON opendolphin.orca_operation (facility_id, encounter_key, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_operation_status
    ON opendolphin.orca_operation (facility_id, operation_status, requested_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.orca_transmission (
    orca_transmission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orca_operation_id BIGINT NOT NULL REFERENCES opendolphin.orca_operation(orca_operation_id) ON DELETE RESTRICT,
    facility_id VARCHAR(64) NOT NULL,
    source_api VARCHAR(64) NOT NULL,
    transmission_status VARCHAR(32) NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    request_hash VARCHAR(64) NOT NULL,
    response_hash VARCHAR(64),
    http_status INTEGER,
    api_result VARCHAR(32),
    api_result_message_category VARCHAR(128),
    transport_status VARCHAR(32) NOT NULL,
    request_id VARCHAR(128),
    trace_id VARCHAR(128),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    elapsed_ms BIGINT,
    request_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_transmission_status CHECK (transmission_status IN (
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
    CONSTRAINT ck_orca_transmission_transport CHECK (transport_status IN (
        'NOT_SENT',
        'HTTP_OK',
        'HTTP_ERROR',
        'NETWORK_FAILED',
        'CERTIFICATE_FAILED',
        'AUTH_FAILED',
        'TIMEOUT',
        'PARSE_FAILED',
        'UNKNOWN'
    )),
    CONSTRAINT ck_orca_transmission_attempt CHECK (attempt_number > 0),
    CONSTRAINT ck_orca_transmission_elapsed CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),
    CONSTRAINT ck_orca_transmission_request_hash CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_orca_transmission_response_hash CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_orca_transmission_operation
    ON opendolphin.orca_transmission (orca_operation_id, attempt_number DESC);

CREATE INDEX IF NOT EXISTS idx_orca_transmission_status
    ON opendolphin.orca_transmission (facility_id, transmission_status, started_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.orca_response_summary (
    orca_response_summary_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orca_operation_id BIGINT NOT NULL REFERENCES opendolphin.orca_operation(orca_operation_id) ON DELETE RESTRICT,
    orca_transmission_id BIGINT REFERENCES opendolphin.orca_transmission(orca_transmission_id) ON DELETE SET NULL,
    facility_id VARCHAR(64) NOT NULL,
    source_api VARCHAR(64) NOT NULL,
    operation_status VARCHAR(32) NOT NULL,
    api_result VARCHAR(32),
    api_result_message_category VARCHAR(128),
    needs_user_review BOOLEAN NOT NULL DEFAULT FALSE,
    perform_date DATE,
    department_code VARCHAR(32),
    physician_code VARCHAR(32),
    insurance_combination_number VARCHAR(32),
    response_hash VARCHAR(64),
    warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    unmatched_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    orca_only_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    renumbered_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    normalized_response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    summarized_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_response_summary_status CHECK (operation_status IN (
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
    CONSTRAINT ck_orca_response_summary_hash CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_orca_response_summary_operation
    ON opendolphin.orca_response_summary (orca_operation_id, summarized_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_response_summary_review
    ON opendolphin.orca_response_summary (facility_id, needs_user_review, summarized_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.orca_reconciliation_result (
    orca_reconciliation_result_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orca_operation_id BIGINT NOT NULL REFERENCES opendolphin.orca_operation(orca_operation_id) ON DELETE RESTRICT,
    orca_transmission_id BIGINT REFERENCES opendolphin.orca_transmission(orca_transmission_id) ON DELETE SET NULL,
    facility_id VARCHAR(64) NOT NULL,
    reconciliation_type VARCHAR(64) NOT NULL,
    reconciliation_status VARCHAR(32) NOT NULL,
    source_api VARCHAR(64) NOT NULL,
    matched_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    needs_user_review BOOLEAN NOT NULL DEFAULT TRUE,
    resend_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    resend_block_reason VARCHAR(128),
    actor_user_id VARCHAR(128),
    request_id VARCHAR(128),
    trace_id VARCHAR(128),
    response_hash VARCHAR(64),
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_reconciliation_type CHECK (reconciliation_type IN (
        'POST_MUTATION_REFETCH',
        'TEMPORARY_MEDICAL_REFETCH',
        'BILLING_REFETCH',
        'INCOME_REFETCH',
        'REPORT_REFETCH',
        'RESTORE_REALIGNMENT'
    )),
    CONSTRAINT ck_orca_reconciliation_status CHECK (reconciliation_status IN (
        'MATCHED',
        'UNMATCHED',
        'CONFLICT',
        'ORCA_ONLY',
        'LOCAL_ONLY',
        'UNKNOWN',
        'NEEDS_REVIEW',
        'BLOCKED'
    )),
    CONSTRAINT ck_orca_reconciliation_counts CHECK (matched_count >= 0 AND total_count >= 0 AND matched_count <= total_count),
    CONSTRAINT ck_orca_reconciliation_hash CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_orca_reconciliation_operation
    ON opendolphin.orca_reconciliation_result (orca_operation_id, reconciled_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_reconciliation_status
    ON opendolphin.orca_reconciliation_result (facility_id, reconciliation_status, reconciled_at DESC);
