SET search_path TO opendolphin, public;

CREATE TABLE IF NOT EXISTS user_security_state (
    user_pk BIGINT PRIMARY KEY,
    credential_epoch BIGINT NOT NULL DEFAULT 0,
    session_epoch BIGINT NOT NULL DEFAULT 0,
    password_changed_at TIMESTAMPTZ,
    factor2_required BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_session_registry (
    session_id VARCHAR(128) PRIMARY KEY,
    user_pk BIGINT NOT NULL,
    actor_id VARCHAR(128) NOT NULL,
    facility_id VARCHAR(64),
    client_uuid VARCHAR(128),
    factor_level VARCHAR(32) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason VARCHAR(64),
    credential_epoch_at_issue BIGINT NOT NULL,
    session_epoch_at_issue BIGINT NOT NULL,
    step_up_scope VARCHAR(128),
    step_up_verified_at TIMESTAMPTZ,
    step_up_expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_session_registry_user_active
    ON auth_session_registry (user_pk, revoked_at, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_session_registry_session_active
    ON auth_session_registry (session_id, revoked_at);

CREATE TABLE IF NOT EXISTS audit_event (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_time TIMESTAMPTZ NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(256) NOT NULL,
    actor_id VARCHAR(128),
    actor_role VARCHAR(64),
    facility_id VARCHAR(64),
    subject_type VARCHAR(64),
    subject_id VARCHAR(128),
    outcome VARCHAR(16) NOT NULL,
    http_status INTEGER,
    trace_id VARCHAR(128),
    request_id VARCHAR(128),
    ip_address VARCHAR(64),
    user_agent_hash VARCHAR(128),
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload_hash VARCHAR(64) NOT NULL,
    previous_event_id BIGINT,
    previous_hash VARCHAR(64),
    event_hash VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_event_time_desc
    ON audit_event (event_time DESC, event_id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_event_trace_id
    ON audit_event (trace_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_subject
    ON audit_event (subject_type, subject_id, event_time DESC);

CREATE TABLE IF NOT EXISTS audit_chain_head (
    singleton_key SMALLINT PRIMARY KEY CHECK (singleton_key = 1),
    head_event_id BIGINT,
    head_hash VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO audit_chain_head (singleton_key, head_event_id, head_hash)
VALUES (1, NULL, NULL)
ON CONFLICT (singleton_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_export_outbox (
    event_id BIGINT NOT NULL REFERENCES audit_event(event_id) ON DELETE CASCADE,
    destination VARCHAR(64) NOT NULL,
    delivery_state VARCHAR(16) NOT NULL,
    last_attempt_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    PRIMARY KEY (event_id, destination)
);

CREATE INDEX IF NOT EXISTS idx_audit_export_outbox_delivery
    ON audit_export_outbox (delivery_state, last_attempt_at, attempt_count);
