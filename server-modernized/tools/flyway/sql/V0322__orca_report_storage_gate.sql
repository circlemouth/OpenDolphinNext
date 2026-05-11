ALTER TABLE opendolphin.orca_report_snapshot
    ADD COLUMN IF NOT EXISTS storage_upload_status VARCHAR(32) NOT NULL DEFAULT 'NOT_UPLOADED',
    ADD COLUMN IF NOT EXISTS storage_uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS storage_retention_until TIMESTAMPTZ;

ALTER TABLE opendolphin.orca_report_snapshot
    DROP CONSTRAINT IF EXISTS ck_orca_report_snapshot_upload_status,
    ADD CONSTRAINT ck_orca_report_snapshot_upload_status CHECK (
        storage_upload_status IN (
            'NOT_UPLOADED',
            'UPLOADED',
            'UPLOAD_FAILED',
            'RETENTION_BLOCKED',
            'EXPIRED'
        )
    );

ALTER TABLE opendolphin.orca_report_snapshot
    DROP CONSTRAINT IF EXISTS ck_orca_report_snapshot_upload_gate,
    ADD CONSTRAINT ck_orca_report_snapshot_upload_gate CHECK (
        (
            storage_upload_status = 'NOT_UPLOADED'
            AND storage_uploaded_at IS NULL
            AND storage_retention_until IS NULL
        )
        OR (
            storage_upload_status IN ('UPLOADED', 'RETENTION_BLOCKED')
            AND server_storage_object_key IS NOT NULL
            AND server_storage_digest IS NOT NULL
            AND storage_uploaded_at IS NOT NULL
            AND storage_retention_until IS NOT NULL
            AND storage_retention_until >= storage_uploaded_at
        )
        OR (
            storage_upload_status IN ('UPLOAD_FAILED', 'EXPIRED')
            AND storage_uploaded_at IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_orca_report_snapshot_storage_upload
    ON opendolphin.orca_report_snapshot (facility_id, storage_upload_status, fetched_at DESC);
