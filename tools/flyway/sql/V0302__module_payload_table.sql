-- P6-08: module payload schema rollout for versioned envelope storage

SET search_path TO opendolphin, public;

CREATE TABLE IF NOT EXISTS d_module_payload (
    module_id BIGINT NOT NULL,
    schema_version INTEGER NOT NULL,
    module_type VARCHAR(64) NOT NULL,
    payload_json JSONB NOT NULL,
    payload_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT d_module_payload_pkey PRIMARY KEY (module_id),
    CONSTRAINT fk_d_module_payload_module FOREIGN KEY (module_id) REFERENCES d_module(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS d_module_payload_type_idx ON d_module_payload (module_type);
CREATE INDEX IF NOT EXISTS d_module_payload_hash_idx ON d_module_payload (payload_hash);

INSERT INTO d_module_payload (
    module_id,
    schema_version,
    module_type,
    payload_json,
    payload_hash,
    created_at,
    updated_at
)
SELECT
    m.id,
    COALESCE(NULLIF(m.bean_json->>'schemaVersion', '')::INTEGER, 1),
    NULLIF(m.bean_json->>'moduleType', ''),
    (m.bean_json->>'payloadJson')::JSONB,
    NULLIF(m.bean_json->>'payloadHash', ''),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM d_module m
WHERE m.bean_json IS NOT NULL
  AND m.bean_json ? 'schemaVersion'
  AND m.bean_json ? 'moduleType'
  AND m.bean_json ? 'payloadJson'
  AND NULLIF(m.bean_json->>'payloadJson', '') IS NOT NULL
ON CONFLICT (module_id) DO UPDATE SET
    schema_version = EXCLUDED.schema_version,
    module_type = EXCLUDED.module_type,
    payload_json = EXCLUDED.payload_json,
    payload_hash = EXCLUDED.payload_hash,
    updated_at = CURRENT_TIMESTAMP;
