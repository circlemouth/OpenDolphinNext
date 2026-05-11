CREATE TABLE IF NOT EXISTS opendolphin.encounter_orca_acceptance_link (
    link_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_key VARCHAR(128) NOT NULL,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
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
    link_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    warning_status VARCHAR(64) NOT NULL DEFAULT 'CLEAR',
    changed_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    cache_fetched_at TIMESTAMPTZ,
    cache_expires_at TIMESTAMPTZ,
    raw_sensitive_fields_excluded BOOLEAN NOT NULL DEFAULT TRUE,
    client_provided_identifiers_trusted BOOLEAN NOT NULL DEFAULT FALSE,
    server_derived_authority_required BOOLEAN NOT NULL DEFAULT TRUE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_encounter_orca_acceptance_link_encounter UNIQUE (encounter_key),
    CONSTRAINT ck_encounter_orca_acceptance_link_source CHECK (source_system = 'ORCA'),
    CONSTRAINT ck_encounter_orca_acceptance_link_status CHECK (link_status IN (
        'CURRENT',
        'DIFF_DETECTED',
        'CANCELLED',
        'NEEDS_REVIEW',
        'UNAVAILABLE',
        'UNKNOWN'
    )),
    CONSTRAINT ck_encounter_orca_acceptance_link_warning CHECK (warning_status IN (
        'CLEAR',
        'ORCA_ACCEPTANCE_CANCELLED',
        'ORCA_ACCEPTANCE_DIFF_DETECTED',
        'ORCA_ACCEPTANCE_NEEDS_REVIEW',
        'ORCA_ACCEPTANCE_STALE_OR_UNRESOLVED'
    )),
    CONSTRAINT ck_encounter_orca_acceptance_link_authority CHECK (
        raw_sensitive_fields_excluded IS TRUE
        AND client_provided_identifiers_trusted IS FALSE
        AND server_derived_authority_required IS TRUE
    )
);

CREATE INDEX IF NOT EXISTS idx_encounter_orca_acceptance_link_acceptance
    ON opendolphin.encounter_orca_acceptance_link (facility_id, acceptance_date, orca_acceptance_key);

CREATE INDEX IF NOT EXISTS idx_encounter_orca_acceptance_link_warning
    ON opendolphin.encounter_orca_acceptance_link (facility_id, warning_status, acceptance_date DESC);
