CREATE TABLE IF NOT EXISTS opendolphin.orca_medical_candidate (
    orca_medical_candidate_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    chart_revision_id VARCHAR(128) NOT NULL,
    prescription_order_id BIGINT
        REFERENCES opendolphin.prescription_order(prescription_order_id) ON DELETE RESTRICT,
    prescription_order_revision_id BIGINT
        REFERENCES opendolphin.prescription_order_revision(prescription_order_revision_id) ON DELETE RESTRICT,
    patient_id VARCHAR(64) NOT NULL,
    encounter_id VARCHAR(128),
    candidate_status VARCHAR(32) NOT NULL,
    sendable BOOLEAN NOT NULL DEFAULT FALSE,
    source_system VARCHAR(64) NOT NULL DEFAULT 'LOCAL_PRESCRIPTION',
    candidate_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    issue_summary_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(128) NOT NULL,
    CONSTRAINT ck_orca_medical_candidate_status CHECK (candidate_status IN (
        'READY_TO_SEND',
        'NEEDS_REVIEW'
    )),
    CONSTRAINT ck_orca_medical_candidate_source CHECK (source_system IN (
        'LOCAL_PRESCRIPTION'
    ))
);

CREATE INDEX IF NOT EXISTS idx_orca_medical_candidate_chart_revision
    ON opendolphin.orca_medical_candidate (facility_id, chart_revision_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_medical_candidate_status
    ON opendolphin.orca_medical_candidate (facility_id, candidate_status, created_at DESC);
