CREATE TABLE IF NOT EXISTS opendolphin.chart_document (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass) PRIMARY KEY,
    document_key VARCHAR(64) NOT NULL,
    facility_id VARCHAR(64) NOT NULL,
    karte_id BIGINT NOT NULL REFERENCES opendolphin.d_karte(id) ON DELETE RESTRICT,
    patient_id BIGINT NOT NULL REFERENCES opendolphin.d_patient(id) ON DELETE RESTRICT,
    legacy_document_id BIGINT REFERENCES opendolphin.d_document(id) ON DELETE SET NULL,
    current_revision_id BIGINT,
    created_by_user_id BIGINT NOT NULL REFERENCES opendolphin.d_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_chart_document_key UNIQUE (facility_id, document_key),
    CONSTRAINT uk_chart_document_legacy_document UNIQUE (legacy_document_id)
);

CREATE INDEX IF NOT EXISTS idx_chart_document_karte
    ON opendolphin.chart_document (facility_id, karte_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chart_document_patient
    ON opendolphin.chart_document (facility_id, patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.chart_revision (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass) PRIMARY KEY,
    chart_document_id BIGINT NOT NULL REFERENCES opendolphin.chart_document(id) ON DELETE RESTRICT,
    revision_number INTEGER NOT NULL,
    status VARCHAR(16) NOT NULL,
    source_document_id BIGINT REFERENCES opendolphin.d_document(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64),
    entered_by_user_id BIGINT NOT NULL REFERENCES opendolphin.d_users(id) ON DELETE RESTRICT,
    finalized_by_user_id BIGINT REFERENCES opendolphin.d_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalized_at TIMESTAMPTZ,
    CONSTRAINT uk_chart_revision_number UNIQUE (chart_document_id, revision_number),
    CONSTRAINT ck_chart_revision_number_positive CHECK (revision_number >= 1),
    CONSTRAINT ck_chart_revision_status CHECK (status IN (
        'DRAFT',
        'FINAL',
        'AMENDED',
        'ADDENDUM',
        'CANCELLED',
        'VOIDED'
    )),
    CONSTRAINT ck_chart_revision_hash CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_chart_revision_finalized_metadata CHECK (
        (status = 'DRAFT' AND finalized_at IS NULL AND finalized_by_user_id IS NULL)
        OR (status <> 'DRAFT' AND finalized_at IS NOT NULL AND finalized_by_user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_chart_revision_document_status
    ON opendolphin.chart_revision (chart_document_id, status, revision_number DESC);

CREATE INDEX IF NOT EXISTS idx_chart_revision_source_document
    ON opendolphin.chart_revision (source_document_id);

ALTER TABLE opendolphin.chart_document
    ADD CONSTRAINT fk_chart_document_current_revision
    FOREIGN KEY (current_revision_id) REFERENCES opendolphin.chart_revision(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS opendolphin.chart_revision_event (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass) PRIMARY KEY,
    chart_document_id BIGINT NOT NULL REFERENCES opendolphin.chart_document(id) ON DELETE RESTRICT,
    chart_revision_id BIGINT REFERENCES opendolphin.chart_revision(id) ON DELETE SET NULL,
    previous_revision_id BIGINT REFERENCES opendolphin.chart_revision(id) ON DELETE SET NULL,
    new_revision_id BIGINT REFERENCES opendolphin.chart_revision(id) ON DELETE SET NULL,
    event_type VARCHAR(32) NOT NULL,
    actor_user_id BIGINT NOT NULL REFERENCES opendolphin.d_users(id) ON DELETE RESTRICT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason_code VARCHAR(64),
    reason_text VARCHAR(1000),
    before_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_hash VARCHAR(64),
    CONSTRAINT ck_chart_revision_event_type CHECK (event_type IN (
        'DRAFT_CREATED',
        'FINALIZED',
        'AMENDED',
        'ADDENDUM_ADDED',
        'CANCELLED',
        'VOIDED',
        'STATUS_CHANGED'
    )),
    CONSTRAINT ck_chart_revision_event_hash CHECK (event_hash IS NULL OR event_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_chart_revision_event_document
    ON opendolphin.chart_revision_event (chart_document_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_chart_revision_event_revision
    ON opendolphin.chart_revision_event (chart_revision_id, occurred_at DESC);
