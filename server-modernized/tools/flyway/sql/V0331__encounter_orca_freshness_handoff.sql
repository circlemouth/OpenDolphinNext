ALTER TABLE opendolphin.encounter_orca_acceptance_link
    ADD COLUMN IF NOT EXISTS patient_cache_status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS patient_business_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS patient_cache_fetched_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS patient_cache_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS patient_warning_status VARCHAR(64) NOT NULL DEFAULT 'PATIENT_CACHE_STALE_OR_UNRESOLVED',
    ADD COLUMN IF NOT EXISTS insurance_cache_status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS insurance_cache_fetched_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS insurance_cache_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS insurance_warning_status VARCHAR(64) NOT NULL DEFAULT 'INSURANCE_CACHE_STALE_OR_UNRESOLVED',
    ADD COLUMN IF NOT EXISTS insurance_changed_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE opendolphin.encounter_orca_acceptance_link
    DROP CONSTRAINT IF EXISTS ck_encounter_orca_acceptance_link_patient_warning,
    ADD CONSTRAINT ck_encounter_orca_acceptance_link_patient_warning CHECK (
        patient_warning_status IN (
            'CLEAR',
            'PATIENT_CACHE_STALE_OR_UNRESOLVED',
            'ORCA_PATIENT_NOT_FOUND',
            'ORCA_PATIENT_NEEDS_REVIEW',
            'ORCA_PATIENT_UNAVAILABLE'
        )
    );

ALTER TABLE opendolphin.encounter_orca_acceptance_link
    DROP CONSTRAINT IF EXISTS ck_encounter_orca_acceptance_link_insurance_warning,
    ADD CONSTRAINT ck_encounter_orca_acceptance_link_insurance_warning CHECK (
        insurance_warning_status IN (
            'CLEAR',
            'INSURANCE_CACHE_STALE_OR_UNRESOLVED',
            'ORCA_INSURANCE_DIFF_DETECTED',
            'ORCA_INSURANCE_NEEDS_REVIEW',
            'ORCA_INSURANCE_UNAVAILABLE'
        )
    );

CREATE INDEX IF NOT EXISTS idx_encounter_orca_acceptance_link_patient_warning
    ON opendolphin.encounter_orca_acceptance_link (facility_id, patient_warning_status, acceptance_date DESC);

CREATE INDEX IF NOT EXISTS idx_encounter_orca_acceptance_link_insurance_warning
    ON opendolphin.encounter_orca_acceptance_link (facility_id, insurance_warning_status, acceptance_date DESC);
