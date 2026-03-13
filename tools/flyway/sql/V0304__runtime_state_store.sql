SET search_path TO opendolphin, public;

CREATE TABLE IF NOT EXISTS runtime_state_store (
    state_category VARCHAR(64) NOT NULL,
    state_key VARCHAR(128) NOT NULL,
    payload_json JSONB NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT runtime_state_store_pkey PRIMARY KEY (state_category, state_key)
);

CREATE INDEX IF NOT EXISTS idx_runtime_state_store_updated_at
    ON runtime_state_store(updated_at DESC);
