ALTER TABLE opendolphin.orca_operation
    ADD COLUMN IF NOT EXISTS central_audit_trace_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS central_audit_action VARCHAR(64),
    ADD COLUMN IF NOT EXISTS unknown_classification VARCHAR(64),
    ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_orca_operation_audit_trace
    ON opendolphin.orca_operation (central_audit_trace_id)
    WHERE central_audit_trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orca_operation_unknown_review
    ON opendolphin.orca_operation (facility_id, unknown_classification, requested_at DESC)
    WHERE unknown_classification IS NOT NULL;

ALTER TABLE opendolphin.orca_operation
    ADD CONSTRAINT ck_orca_operation_unknown_classification CHECK (
        unknown_classification IS NULL OR unknown_classification IN (
            'NETWORK_FAILED',
            'AUTH_FAILED',
            'CERT_FAILED',
            'BUSINESS_ERROR',
            'WARNING_NEEDS_REVIEW',
            'UNMATCHED',
            'UNKNOWN'
        )
    );

ALTER TABLE opendolphin.orca_operation
    ADD CONSTRAINT ck_orca_operation_reconciliation_status CHECK (
        reconciliation_status IS NULL OR reconciliation_status IN (
            'NOT_REQUIRED',
            'PENDING',
            'MATCHED',
            'UNMATCHED',
            'CONFLICT',
            'ORCA_ONLY',
            'LOCAL_ONLY',
            'UNKNOWN',
            'NEEDS_REVIEW',
            'BLOCKED'
        )
    );

ALTER TABLE opendolphin.orca_reconciliation_result
    DROP CONSTRAINT IF EXISTS ck_orca_reconciliation_status;

ALTER TABLE opendolphin.orca_reconciliation_result
    ADD CONSTRAINT ck_orca_reconciliation_status CHECK (reconciliation_status IN (
        'PENDING',
        'MATCHED',
        'UNMATCHED',
        'CONFLICT',
        'ORCA_ONLY',
        'LOCAL_ONLY',
        'UNKNOWN',
        'NEEDS_REVIEW',
        'BLOCKED'
    ));
