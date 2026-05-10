CREATE TABLE IF NOT EXISTS opendolphin.d_diagnosis_entry (
    diagnosis_entry_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    department_code VARCHAR(32),
    inout_class VARCHAR(8),
    insurance_combination_number VARCHAR(32),
    display_name VARCHAR(512) NOT NULL,
    karte_name VARCHAR(512),
    start_date DATE NOT NULL,
    end_date DATE,
    outcome VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    orca_outcome_send_code VARCHAR(8),
    orca_outcome_received_code VARCHAR(8),
    disease_category VARCHAR(32),
    suspected_flag VARCHAR(16),
    acute_flag VARCHAR(16),
    disease_class VARCHAR(32),
    receipt_print_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_print_period VARCHAR(64),
    insurance_disease_flag VARCHAR(16),
    discharge_certificate_flag VARCHAR(16),
    main_disease_class VARCHAR(32),
    sub_disease_class VARCHAR(32),
    master_version VARCHAR(64),
    orca_snapshot_hash VARCHAR(64) NOT NULL,
    sync_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_by VARCHAR(128),
    updated_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_diagnosis_entry_outcome CHECK (outcome IN (
        'ACTIVE',
        'CURED',
        'DEATH',
        'DISCONTINUED',
        'TRANSFERRED',
        'DELETED'
    )),
    CONSTRAINT ck_diagnosis_entry_sync_status CHECK (sync_status IN (
        'PENDING',
        'SYNCED',
        'WARNING',
        'ERROR'
    )),
    CONSTRAINT ck_diagnosis_entry_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_diagnosis_entry_orca_snapshot
    ON opendolphin.d_diagnosis_entry (facility_id, patient_id, orca_snapshot_hash);

CREATE INDEX IF NOT EXISTS idx_diagnosis_entry_patient
    ON opendolphin.d_diagnosis_entry (facility_id, patient_id, start_date DESC);

CREATE TABLE IF NOT EXISTS opendolphin.d_diagnosis_component (
    diagnosis_component_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    diagnosis_entry_id BIGINT NOT NULL REFERENCES opendolphin.d_diagnosis_entry(diagnosis_entry_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    component_type VARCHAR(16) NOT NULL,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(256) NOT NULL,
    source_master VARCHAR(64),
    valid_from DATE,
    valid_to DATE,
    condition VARCHAR(32),
    CONSTRAINT uk_diagnosis_component_seq UNIQUE (diagnosis_entry_id, seq),
    CONSTRAINT ck_diagnosis_component_seq CHECK (seq BETWEEN 1 AND 21),
    CONSTRAINT ck_diagnosis_component_type CHECK (component_type IN (
        'PREFIX',
        'SITE',
        'BODY',
        'SUFFIX',
        'UNKNOWN'
    ))
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_component_code
    ON opendolphin.d_diagnosis_component (code);

CREATE TABLE IF NOT EXISTS opendolphin.d_diagnosis_supplement (
    diagnosis_supplement_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    diagnosis_entry_id BIGINT NOT NULL REFERENCES opendolphin.d_diagnosis_entry(diagnosis_entry_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    supplement_code VARCHAR(32),
    supplement_name VARCHAR(512),
    CONSTRAINT uk_diagnosis_supplement_seq UNIQUE (diagnosis_entry_id, seq),
    CONSTRAINT ck_diagnosis_supplement_seq CHECK (seq BETWEEN 1 AND 21)
);

CREATE TABLE IF NOT EXISTS opendolphin.d_diagnosis_orca_sync_log (
    diagnosis_orca_sync_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    diagnosis_entry_id BIGINT REFERENCES opendolphin.d_diagnosis_entry(diagnosis_entry_id) ON DELETE SET NULL,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    operation VARCHAR(32) NOT NULL,
    sync_status VARCHAR(32) NOT NULL,
    api_result VARCHAR(32),
    response_classification VARCHAR(64),
    request_hash VARCHAR(64),
    response_hash VARCHAR(64),
    warning_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    unmatch_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    trace_id VARCHAR(128),
    run_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_diagnosis_orca_sync_log_operation CHECK (operation IN (
        'create',
        'update',
        'delete',
        'organizeDeletedDiseases',
        'mirror'
    )),
    CONSTRAINT ck_diagnosis_orca_sync_log_status CHECK (sync_status IN (
        'PENDING',
        'SYNCED',
        'WARNING',
        'ERROR'
    ))
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_orca_sync_log_patient
    ON opendolphin.d_diagnosis_orca_sync_log (facility_id, patient_id, created_at DESC);
