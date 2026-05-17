CREATE TABLE IF NOT EXISTS opendolphin.chart_edit_session (
    chart_edit_session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    encounter_scope VARCHAR(256) NOT NULL,
    lease_id VARCHAR(64) NOT NULL,
    owner_user_id VARCHAR(128) NOT NULL,
    owner_run_id VARCHAR(64),
    owner_tab_session_id VARCHAR(128),
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    takeover_count INTEGER NOT NULL DEFAULT 0,
    stale_takeover_at TIMESTAMPTZ,
    stale_takeover_by VARCHAR(128),
    released_at TIMESTAMPTZ,
    release_reason VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_chart_edit_session_scope UNIQUE (facility_id, patient_id, encounter_scope),
    CONSTRAINT ck_chart_edit_session_ttl CHECK (expires_at > acquired_at)
);

CREATE INDEX IF NOT EXISTS idx_chart_edit_session_scope_active
    ON opendolphin.chart_edit_session (facility_id, patient_id, encounter_scope, expires_at)
    WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chart_edit_session_lease
    ON opendolphin.chart_edit_session (lease_id);
