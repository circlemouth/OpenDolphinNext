SET search_path TO opendolphin, public;

CREATE TABLE IF NOT EXISTS d_orca_patient_sync_state (
    facility_id VARCHAR(128) NOT NULL,
    last_sync_date DATE,
    last_synced_at TIMESTAMPTZ,
    last_run_id VARCHAR(64),
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT d_orca_patient_sync_state_pkey PRIMARY KEY (facility_id)
);
