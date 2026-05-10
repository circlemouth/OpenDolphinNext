ALTER TABLE opendolphin.prescription_order_item
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(64);

COMMENT ON COLUMN opendolphin.prescription_order_item.created_by
    IS 'Server-resolved prescription item input actor; never trusted from client payload.';
