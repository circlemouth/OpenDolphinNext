ALTER TABLE opendolphin.prescription_order_event
    ALTER COLUMN previous_event_hash SET DEFAULT repeat('0', 64);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM opendolphin.prescription_order_event
         WHERE previous_event_hash IS NULL
            OR event_hash IS NULL
    ) THEN
        RAISE EXCEPTION 'prescription_order_event contains events without hash chain material';
    END IF;
END $$;

ALTER TABLE opendolphin.prescription_order_event
    ALTER COLUMN previous_event_hash SET NOT NULL,
    ALTER COLUMN event_hash SET NOT NULL;

ALTER TABLE opendolphin.prescription_order_event
    DROP CONSTRAINT IF EXISTS ck_prescription_order_event_type;

ALTER TABLE opendolphin.prescription_order_event
    DROP CONSTRAINT IF EXISTS ck_prescription_order_event_hash_format,
    DROP CONSTRAINT IF EXISTS ck_prescription_order_event_previous_hash_format;

ALTER TABLE opendolphin.prescription_order_event
    ADD CONSTRAINT ck_prescription_order_event_type CHECK (event_type IN (
        'CREATE',
        'FINALIZE',
        'CHANGE',
        'STOP',
        'CANCEL',
        'REISSUE',
        'RESEND'
    ));

ALTER TABLE opendolphin.prescription_order_event
    ADD CONSTRAINT ck_prescription_order_event_hash_format CHECK (event_hash ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT ck_prescription_order_event_previous_hash_format CHECK (previous_event_hash ~ '^[0-9a-f]{64}$');
