ALTER TABLE opendolphin.chart_revision
    ADD COLUMN IF NOT EXISTS encounter_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS encounter_date DATE,
    ADD COLUMN IF NOT EXISTS orca_patient_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS orca_acceptance_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS no_acceptance_reason VARCHAR(255),
    ADD COLUMN IF NOT EXISTS department_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS physician_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS insurance_combination_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS finalize_context_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE opendolphin.chart_revision
    ADD CONSTRAINT ck_chart_revision_acceptance_context CHECK (
        status = 'DRAFT'
        OR orca_acceptance_id IS NOT NULL
        OR no_acceptance_reason IS NOT NULL
    );

CREATE INDEX IF NOT EXISTS idx_chart_revision_encounter
    ON opendolphin.chart_revision (encounter_id, encounter_date);

CREATE INDEX IF NOT EXISTS idx_chart_revision_orca_patient
    ON opendolphin.chart_revision (orca_patient_id);
