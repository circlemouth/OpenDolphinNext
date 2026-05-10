CREATE TABLE IF NOT EXISTS opendolphin.orca_billing_cache (
    orca_billing_cache_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    source_system VARCHAR(16) NOT NULL DEFAULT 'ORCA',
    source_api VARCHAR(64) NOT NULL DEFAULT 'incomeinfv2',
    cache_status VARCHAR(32) NOT NULL,
    orca_patient_id VARCHAR(64) NOT NULL,
    base_date VARCHAR(16) NOT NULL,
    http_status INTEGER,
    api_result VARCHAR(32),
    api_result_message_category VARCHAR(128),
    request_hash VARCHAR(64) NOT NULL,
    response_hash VARCHAR(64),
    entry_count INTEGER NOT NULL DEFAULT 0,
    invoice_hashes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    unpaid_money_total NUMERIC(14, 2),
    unpaid_money_overflow BOOLEAN NOT NULL DEFAULT FALSE,
    normalized_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cache_expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_billing_cache_source CHECK (source_system = 'ORCA'),
    CONSTRAINT ck_orca_billing_cache_api CHECK (source_api IN (
        'incomeinfv2',
        'acsimv2',
        'dailyreceiptv2',
        'paymentlistv2'
    )),
    CONSTRAINT ck_orca_billing_cache_status CHECK (cache_status IN (
        'CURRENT',
        'NEEDS_REVIEW',
        'UNAVAILABLE'
    )),
    CONSTRAINT ck_orca_billing_cache_http_status CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
    CONSTRAINT ck_orca_billing_cache_entry_count CHECK (entry_count >= 0),
    CONSTRAINT ck_orca_billing_cache_hash CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_orca_billing_cache_response_hash CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_orca_billing_cache_patient
    ON opendolphin.orca_billing_cache (facility_id, orca_patient_id, base_date, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_billing_cache_status
    ON opendolphin.orca_billing_cache (facility_id, cache_status, fetched_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.orca_report_snapshot (
    orca_report_snapshot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    source_system VARCHAR(16) NOT NULL DEFAULT 'ORCA',
    source_api VARCHAR(64) NOT NULL,
    report_type VARCHAR(32) NOT NULL,
    snapshot_status VARCHAR(32) NOT NULL,
    orca_patient_id VARCHAR(64) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_hash VARCHAR(64),
    invoice_number_hash VARCHAR(64),
    data_id_hash VARCHAR(64),
    form_id VARCHAR(64),
    form_name VARCHAR(128),
    server_storage_object_key VARCHAR(256),
    server_storage_digest VARCHAR(64),
    http_status INTEGER,
    api_result VARCHAR(32),
    api_result_message_category VARCHAR(128),
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    snapshot_reason VARCHAR(64) NOT NULL DEFAULT 'ORCA_REPORT_FETCH',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_orca_report_snapshot_source CHECK (source_system = 'ORCA'),
    CONSTRAINT ck_orca_report_snapshot_api CHECK (source_api IN (
        'prescriptionv2',
        'medicine_notebookv2',
        'karte_no1v2',
        'karte_no3v2',
        'invoice_receiptv2',
        'statementv2'
    )),
    CONSTRAINT ck_orca_report_snapshot_type CHECK (report_type IN (
        'PRESCRIPTION',
        'MEDICINE_NOTEBOOK',
        'KARTENO1',
        'KARTENO3',
        'INVOICE_RECEIPT',
        'STATEMENT'
    )),
    CONSTRAINT ck_orca_report_snapshot_status CHECK (snapshot_status IN (
        'CURRENT',
        'NEEDS_REVIEW',
        'UNAVAILABLE'
    )),
    CONSTRAINT ck_orca_report_snapshot_http_status CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
    CONSTRAINT ck_orca_report_snapshot_request_hash CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_orca_report_snapshot_response_hash CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_orca_report_snapshot_invoice_hash CHECK (invoice_number_hash IS NULL OR invoice_number_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_orca_report_snapshot_data_hash CHECK (data_id_hash IS NULL OR data_id_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_orca_report_snapshot_storage_digest CHECK (server_storage_digest IS NULL OR server_storage_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_orca_report_snapshot_patient
    ON opendolphin.orca_report_snapshot (facility_id, orca_patient_id, report_type, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_orca_report_snapshot_status
    ON opendolphin.orca_report_snapshot (facility_id, snapshot_status, fetched_at DESC);
