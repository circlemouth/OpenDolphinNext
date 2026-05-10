CREATE TABLE IF NOT EXISTS opendolphin.prescription_order (
    prescription_order_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    encounter_id VARCHAR(128),
    chart_revision_id VARCHAR(128),
    current_revision_id BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(128) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(128),
    CONSTRAINT ck_prescription_order_status CHECK (status IN (
        'DRAFT',
        'FINAL',
        'CHANGED',
        'STOPPED',
        'CANCELLED',
        'REISSUED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_prescription_order_patient
    ON opendolphin.prescription_order (facility_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescription_order_encounter
    ON opendolphin.prescription_order (facility_id, encounter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.prescription_order_revision (
    prescription_order_revision_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_order_id BIGINT NOT NULL
        REFERENCES opendolphin.prescription_order(prescription_order_id) ON DELETE RESTRICT,
    revision_number INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    reason_code VARCHAR(64),
    reason_text VARCHAR(512),
    content_hash VARCHAR(64),
    finalized_at TIMESTAMPTZ,
    finalized_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(128) NOT NULL,
    source_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    before_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uk_prescription_order_revision UNIQUE (prescription_order_id, revision_number),
    CONSTRAINT ck_prescription_order_revision_status CHECK (status IN (
        'DRAFT',
        'FINAL',
        'CHANGED',
        'STOPPED',
        'CANCELLED',
        'REISSUED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_prescription_order_revision_order
    ON opendolphin.prescription_order_revision (prescription_order_id, revision_number DESC);

ALTER TABLE opendolphin.prescription_order
    ADD CONSTRAINT fk_prescription_order_current_revision
    FOREIGN KEY (current_revision_id)
    REFERENCES opendolphin.prescription_order_revision(prescription_order_revision_id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS opendolphin.prescription_order_item (
    prescription_order_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_order_revision_id BIGINT NOT NULL
        REFERENCES opendolphin.prescription_order_revision(prescription_order_revision_id) ON DELETE RESTRICT,
    item_sequence INTEGER NOT NULL,
    rp_sequence INTEGER,
    drug_code VARCHAR(64),
    drug_name VARCHAR(256) NOT NULL,
    standard_name VARCHAR(256),
    dosage_form VARCHAR(128),
    usage_code VARCHAR(64),
    usage_name VARCHAR(256),
    dose_value VARCHAR(64),
    dose_unit VARCHAR(64),
    days INTEGER,
    prescription_location VARCHAR(32),
    medication_route VARCHAR(32),
    generic_name_prescription BOOLEAN NOT NULL DEFAULT FALSE,
    doctor_comment VARCHAR(1024),
    unresolved_reason VARCHAR(256),
    item_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_prescription_order_item_seq UNIQUE (prescription_order_revision_id, item_sequence),
    CONSTRAINT ck_prescription_order_item_days CHECK (days IS NULL OR days >= 0),
    CONSTRAINT ck_prescription_order_item_location CHECK (
        prescription_location IS NULL OR prescription_location IN ('IN_HOUSE', 'OUTSIDE')
    ),
    CONSTRAINT ck_prescription_order_item_route CHECK (
        medication_route IS NULL OR medication_route IN ('ORAL', 'TOPICAL', 'INJECTION', 'AS_NEEDED', 'OTHER')
    )
);

CREATE INDEX IF NOT EXISTS idx_prescription_order_item_revision
    ON opendolphin.prescription_order_item (prescription_order_revision_id, item_sequence);

CREATE TABLE IF NOT EXISTS opendolphin.prescription_order_event (
    prescription_order_event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_order_id BIGINT NOT NULL
        REFERENCES opendolphin.prescription_order(prescription_order_id) ON DELETE RESTRICT,
    prescription_order_revision_id BIGINT
        REFERENCES opendolphin.prescription_order_revision(prescription_order_revision_id) ON DELETE RESTRICT,
    event_type VARCHAR(32) NOT NULL,
    reason_code VARCHAR(64),
    reason_text VARCHAR(512),
    actor_user_id VARCHAR(128) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    before_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_hash VARCHAR(64),
    previous_event_hash VARCHAR(64),
    CONSTRAINT ck_prescription_order_event_type CHECK (event_type IN (
        'CREATE',
        'FINALIZE',
        'CHANGE',
        'STOP',
        'CANCEL',
        'REISSUE'
    ))
);

CREATE INDEX IF NOT EXISTS idx_prescription_order_event_order
    ON opendolphin.prescription_order_event (prescription_order_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS opendolphin.prescription_orca_transmission (
    prescription_orca_transmission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_order_id BIGINT NOT NULL
        REFERENCES opendolphin.prescription_order(prescription_order_id) ON DELETE RESTRICT,
    prescription_order_revision_id BIGINT NOT NULL
        REFERENCES opendolphin.prescription_order_revision(prescription_order_revision_id) ON DELETE RESTRICT,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    encounter_id VARCHAR(128),
    operation_status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    requested_by VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_hash VARCHAR(64),
    response_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    needs_user_review BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uk_prescription_orca_transmission_idempotency UNIQUE (facility_id, idempotency_key),
    CONSTRAINT ck_prescription_orca_transmission_status CHECK (operation_status IN (
        'PREPARED',
        'READY_TO_SEND',
        'SENDING',
        'ORCA_ACCEPTED',
        'ORCA_REJECTED',
        'ORCA_WARNING',
        'ORCA_UNMATCHED',
        'ORCA_CONFLICT',
        'NETWORK_FAILED',
        'CERTIFICATE_FAILED',
        'AUTH_FAILED',
        'UNKNOWN',
        'NEEDS_REVIEW',
        'CANCELLED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_prescription_orca_transmission_order
    ON opendolphin.prescription_orca_transmission (prescription_order_id, requested_at DESC);

CREATE OR REPLACE FUNCTION opendolphin.reject_finalized_prescription_order_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('opendolphin.prescription_authority_mutation', true) = 'event' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN
            RAISE EXCEPTION 'prescription_order_finalized_update_denied'
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'prescription_order_finalized_update_denied'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_order_finalized_guard ON opendolphin.prescription_order;
CREATE TRIGGER trg_prescription_order_finalized_guard
    BEFORE UPDATE OR DELETE ON opendolphin.prescription_order
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_finalized_prescription_order_mutation();

CREATE OR REPLACE FUNCTION opendolphin.reject_finalized_prescription_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('opendolphin.prescription_authority_mutation', true) = 'event' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN
            RAISE EXCEPTION 'prescription_order_finalized_update_denied'
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'prescription_order_finalized_update_denied'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_revision_finalized_guard ON opendolphin.prescription_order_revision;
CREATE TRIGGER trg_prescription_revision_finalized_guard
    BEFORE UPDATE OR DELETE ON opendolphin.prescription_order_revision
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_finalized_prescription_revision_mutation();

CREATE OR REPLACE FUNCTION opendolphin.reject_prescription_item_finalized_parent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_status VARCHAR(32);
    target_revision_id BIGINT;
BEGIN
    IF current_setting('opendolphin.prescription_authority_mutation', true) = 'event' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        target_revision_id := OLD.prescription_order_revision_id;
    ELSE
        target_revision_id := NEW.prescription_order_revision_id;
    END IF;

    SELECT po.status INTO parent_status
      FROM opendolphin.prescription_order po
      JOIN opendolphin.prescription_order_revision pr
        ON pr.prescription_order_id = po.prescription_order_id
     WHERE pr.prescription_order_revision_id = target_revision_id;

    IF parent_status IS NULL OR parent_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'prescription_order_finalized_update_denied'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_item_finalized_parent_guard ON opendolphin.prescription_order_item;
CREATE TRIGGER trg_prescription_item_finalized_parent_guard
    BEFORE INSERT OR UPDATE OR DELETE ON opendolphin.prescription_order_item
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_prescription_item_finalized_parent_mutation();

CREATE OR REPLACE FUNCTION opendolphin.reject_prescription_event_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'prescription_order_event_append_only'
        USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_event_append_only ON opendolphin.prescription_order_event;
CREATE TRIGGER trg_prescription_event_append_only
    BEFORE UPDATE OR DELETE ON opendolphin.prescription_order_event
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_prescription_event_rewrite();
