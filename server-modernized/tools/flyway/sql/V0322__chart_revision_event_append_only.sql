CREATE OR REPLACE FUNCTION opendolphin.reject_chart_revision_event_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'chart_revision_event_append_only'
        USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_chart_revision_event_append_only ON opendolphin.chart_revision_event;
CREATE TRIGGER trg_chart_revision_event_append_only
    BEFORE UPDATE OR DELETE ON opendolphin.chart_revision_event
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_chart_revision_event_rewrite();
