CREATE TABLE IF NOT EXISTS opendolphin.d_billing_orca_snapshot (
    snapshot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    encounter_key VARCHAR(128) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    schedule_key VARCHAR(128),
    snapshot_version BIGINT NOT NULL,
    state VARCHAR(32) NOT NULL,
    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_billing_orca_snapshot UNIQUE (facility_id, encounter_key, snapshot_version),
    CONSTRAINT ck_billing_orca_snapshot_state CHECK (state IN (
        'DRAFT',
        'READY_TO_SEND',
        'ORCA_SENDING',
        'ORCA_DISEASE_SYNCED',
        'ORCA_MEDICAL_REGISTERED',
        'ORCA_CONFIRMED',
        'ORCA_FAILED',
        'ORCA_UNKNOWN',
        'DIRTY_AFTER_SENT',
        'ORCA_LOCKED_OR_OPENED',
        'CORRECTION_REQUIRED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_billing_orca_snapshot_encounter
    ON opendolphin.d_billing_orca_snapshot (facility_id, encounter_key, snapshot_id DESC);

CREATE TABLE IF NOT EXISTS opendolphin.d_billing_orca_transmission (
    transmission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    snapshot_id BIGINT NOT NULL REFERENCES opendolphin.d_billing_orca_snapshot(snapshot_id),
    facility_id VARCHAR(64) NOT NULL,
    encounter_key VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    state VARCHAR(32) NOT NULL,
    disease_state VARCHAR(32),
    medical_state VARCHAR(32),
    medical_uid VARCHAR(128),
    api_result VARCHAR(32),
    api_result_message VARCHAR(512),
    http_status INTEGER,
    request_id VARCHAR(128),
    trace_id VARCHAR(128),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    error_code VARCHAR(128),
    error_message VARCHAR(512),
    response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uk_billing_orca_transmission_idempotency UNIQUE (facility_id, encounter_key, idempotency_key),
    CONSTRAINT ck_billing_orca_transmission_state CHECK (state IN (
        'DRAFT',
        'READY_TO_SEND',
        'ORCA_SENDING',
        'ORCA_DISEASE_SYNCED',
        'ORCA_MEDICAL_REGISTERED',
        'ORCA_CONFIRMED',
        'ORCA_FAILED',
        'ORCA_UNKNOWN',
        'DIRTY_AFTER_SENT',
        'ORCA_LOCKED_OR_OPENED',
        'CORRECTION_REQUIRED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_billing_orca_transmission_snapshot
    ON opendolphin.d_billing_orca_transmission (snapshot_id, transmission_id DESC);

CREATE INDEX IF NOT EXISTS idx_billing_orca_transmission_encounter
    ON opendolphin.d_billing_orca_transmission (facility_id, encounter_key, started_at DESC);
