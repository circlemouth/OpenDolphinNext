CREATE OR REPLACE FUNCTION opendolphin.reject_locked_chart_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN
            RAISE EXCEPTION 'chart_revision_finalized_update_denied'
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.status <> 'DRAFT' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'chart_revision_finalized_update_denied'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chart_revision_finalized_guard ON opendolphin.chart_revision;
CREATE TRIGGER trg_chart_revision_finalized_guard
    BEFORE UPDATE OR DELETE ON opendolphin.chart_revision
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_locked_chart_revision_mutation();

CREATE OR REPLACE FUNCTION opendolphin.reject_locked_chart_document_current_revision_repoint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    current_status TEXT;
BEGIN
    IF OLD.current_revision_id IS NULL OR OLD.current_revision_id IS NOT DISTINCT FROM NEW.current_revision_id THEN
        RETURN NEW;
    END IF;

    SELECT status
      INTO current_status
      FROM opendolphin.chart_revision
     WHERE id = OLD.current_revision_id;

    IF current_status IS NOT NULL AND current_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'chart_document_finalized_revision_repoint_denied'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chart_document_current_revision_guard ON opendolphin.chart_document;
CREATE TRIGGER trg_chart_document_current_revision_guard
    BEFORE UPDATE OF current_revision_id ON opendolphin.chart_document
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_locked_chart_document_current_revision_repoint();

CREATE OR REPLACE FUNCTION opendolphin.reject_locked_legacy_chart_document_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    has_locked_revision BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
          FROM opendolphin.chart_revision cr
          LEFT JOIN opendolphin.chart_document cd
            ON cd.id = cr.chart_document_id
         WHERE cr.status <> 'DRAFT'
           AND (cr.source_document_id = OLD.id OR cd.legacy_document_id = OLD.id)
    ) INTO has_locked_revision;

    IF has_locked_revision THEN
        RAISE EXCEPTION 'chart_document_finalized_update_denied'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legacy_chart_document_finalized_guard ON opendolphin.d_document;
CREATE TRIGGER trg_legacy_chart_document_finalized_guard
    BEFORE UPDATE OR DELETE ON opendolphin.d_document
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_locked_legacy_chart_document_mutation();

CREATE OR REPLACE FUNCTION opendolphin.reject_locked_legacy_chart_module_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    has_locked_revision BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
          FROM opendolphin.chart_revision cr
          LEFT JOIN opendolphin.chart_document cd
            ON cd.id = cr.chart_document_id
         WHERE cr.status <> 'DRAFT'
           AND (cr.source_document_id = OLD.doc_id OR cd.legacy_document_id = OLD.doc_id)
    ) INTO has_locked_revision;

    IF has_locked_revision THEN
        RAISE EXCEPTION 'chart_module_finalized_update_denied'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legacy_chart_module_finalized_guard ON opendolphin.d_module;
CREATE TRIGGER trg_legacy_chart_module_finalized_guard
    BEFORE UPDATE OR DELETE ON opendolphin.d_module
    FOR EACH ROW
    EXECUTE FUNCTION opendolphin.reject_locked_legacy_chart_module_mutation();
