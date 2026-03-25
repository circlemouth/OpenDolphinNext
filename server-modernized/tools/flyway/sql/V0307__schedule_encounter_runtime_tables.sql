SET search_path TO opendolphin, public;

CREATE TABLE IF NOT EXISTS schedule_projection (
    schedule_key VARCHAR(128) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    karte_id BIGINT,
    orca_appointment_id VARCHAR(64) NOT NULL,
    scheduled_datetime TIMESTAMPTZ NOT NULL,
    department_code VARCHAR(32),
    physician_code VARCHAR(32),
    state VARCHAR(16) NOT NULL,
    linked_encounter_key VARCHAR(128),
    source_updated_at TIMESTAMPTZ,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (facility_id, orca_appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_projection_patient_time
    ON schedule_projection (facility_id, patient_id, scheduled_datetime DESC);

CREATE TABLE IF NOT EXISTS encounter_projection (
    encounter_key VARCHAR(128) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    karte_id BIGINT,
    schedule_key VARCHAR(128),
    orca_acceptance_id VARCHAR(64) NOT NULL,
    acceptance_datetime TIMESTAMPTZ NOT NULL,
    business_state VARCHAR(16) NOT NULL,
    chart_opened_at TIMESTAMPTZ,
    billed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    owner_user_id VARCHAR(128),
    memo TEXT,
    worklist_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_orca_sync_at TIMESTAMPTZ,
    state_version BIGINT NOT NULL DEFAULT 0,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (facility_id, orca_acceptance_id)
);

CREATE INDEX IF NOT EXISTS idx_encounter_projection_patient_time
    ON encounter_projection (facility_id, patient_id, acceptance_datetime DESC);

CREATE INDEX IF NOT EXISTS idx_encounter_projection_state
    ON encounter_projection (facility_id, business_state, acceptance_datetime DESC);

CREATE TABLE IF NOT EXISTS encounter_transition_log (
    transition_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    encounter_key VARCHAR(128) NOT NULL,
    operation VARCHAR(64) NOT NULL,
    from_state VARCHAR(16),
    to_state VARCHAR(16),
    request_id VARCHAR(128) NOT NULL,
    trace_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    last_error TEXT,
    reconciliation_required BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (facility_id, encounter_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_encounter_transition_log_request
    ON encounter_transition_log (request_id, trace_id);

CREATE TABLE IF NOT EXISTS reconciliation_task (
    task_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    subject_type VARCHAR(32) NOT NULL,
    subject_key VARCHAR(128) NOT NULL,
    reason_code VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    priority VARCHAR(16) NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_task_open
    ON reconciliation_task (facility_id, status, priority, updated_at DESC);

CREATE TABLE IF NOT EXISTS encounter_patient_snapshot (
    encounter_key VARCHAR(128) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    snapshot_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS encounter_insurance_snapshot (
    encounter_key VARCHAR(128) NOT NULL,
    insurance_slot VARCHAR(32) NOT NULL,
    snapshot_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (encounter_key, insurance_slot)
);

CREATE TABLE IF NOT EXISTS orca_job_schedule (
    facility_id VARCHAR(64) NOT NULL,
    job_kind VARCHAR(32) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    interval_minutes INTEGER NOT NULL,
    initial_lookback_days INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(128),
    PRIMARY KEY (facility_id, job_kind)
);

CREATE TABLE IF NOT EXISTS d_orca_sync_cursor (
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    cursor_type VARCHAR(16) NOT NULL,
    cursor_value VARCHAR(128) NOT NULL,
    last_applied_run_id VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (facility_id, stream_kind)
);

CREATE TABLE IF NOT EXISTS d_orca_sync_run (
    run_id VARCHAR(64) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    trigger VARCHAR(16) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    requested_count INTEGER NOT NULL DEFAULT 0,
    fetched_count INTEGER NOT NULL DEFAULT 0,
    applied_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL,
    error_code VARCHAR(64),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_d_orca_sync_run_facility_time
    ON d_orca_sync_run (facility_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS d_orca_push_event_inbox (
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    event_uuid VARCHAR(64) NOT NULL,
    event_name VARCHAR(64) NOT NULL,
    event_time TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fetched_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_code VARCHAR(64),
    error_message TEXT,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_recovery_run_id VARCHAR(64),
    PRIMARY KEY (facility_id, stream_kind, event_uuid)
);

CREATE INDEX IF NOT EXISTS idx_d_orca_push_event_inbox_status
    ON d_orca_push_event_inbox (facility_id, stream_kind, status, received_at);

CREATE TABLE IF NOT EXISTS d_orca_push_cursor (
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    last_fetched_event_time TIMESTAMPTZ,
    last_fetched_event_uuid VARCHAR(64),
    last_applied_event_time TIMESTAMPTZ,
    last_applied_event_uuid VARCHAR(64),
    last_recovery_run_id VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (facility_id, stream_kind)
);

CREATE TABLE IF NOT EXISTS d_orca_push_connection_state (
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    connection_status VARCHAR(16) NOT NULL,
    websocket_url VARCHAR(512),
    last_connected_at TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (facility_id, stream_kind)
);
