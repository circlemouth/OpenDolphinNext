CREATE TABLE IF NOT EXISTS opendolphin.d_orca_push_state (
    facility_id varchar(64) PRIMARY KEY,
    connection_status varchar(16) NOT NULL,
    websocket_url varchar(512),
    last_connected_at timestamptz,
    last_disconnected_at timestamptz,
    last_event_at timestamptz,
    last_event_uuid varchar(64),
    last_event_name varchar(64),
    last_recovery_started_at timestamptz,
    last_recovery_finished_at timestamptz,
    last_recovery_window_start timestamptz,
    last_recovery_window_end timestamptz,
    last_error text,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opendolphin.d_orca_push_seen_event (
    facility_id varchar(64) NOT NULL,
    event_uuid varchar(64) NOT NULL,
    event_name varchar(64) NOT NULL,
    event_time timestamptz,
    received_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (facility_id, event_uuid)
);

CREATE INDEX IF NOT EXISTS idx_d_orca_push_seen_event_expires_at
    ON opendolphin.d_orca_push_seen_event (expires_at);
