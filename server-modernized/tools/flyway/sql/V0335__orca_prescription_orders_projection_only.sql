COMMENT ON TABLE opendolphin.orca_prescription_orders IS
    'ORCA-derived cache/projection/read model only. Prescription authority writes are prohibited.';

CREATE OR REPLACE FUNCTION opendolphin.reject_orca_prescription_orders_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'orca_prescription_orders_projection_write_denied'
        USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_orca_prescription_orders_projection_guard
    ON opendolphin.orca_prescription_orders;
CREATE TRIGGER trg_orca_prescription_orders_projection_guard
    BEFORE INSERT OR UPDATE OR DELETE ON opendolphin.orca_prescription_orders
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_orca_prescription_orders_mutation();
