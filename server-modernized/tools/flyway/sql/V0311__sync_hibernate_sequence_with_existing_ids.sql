-- Keep the shared Hibernate sequence ahead of all tables that use it.
-- Manual seeds and fixture restores insert explicit IDs; without this repair,
-- later writes can reuse an existing primary key.
DO $$
DECLARE
    row_info RECORD;
    table_max BIGINT;
    max_id BIGINT := 1;
BEGIN
    FOR row_info IN
        SELECT table_schema, table_name
          FROM information_schema.columns
         WHERE table_schema = 'opendolphin'
           AND column_name = 'id'
           AND column_default LIKE '%hibernate_sequence%'
         ORDER BY table_schema, table_name
    LOOP
        EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I.%I', row_info.table_schema, row_info.table_name)
           INTO table_max;
        max_id := GREATEST(max_id, table_max);
    END LOOP;

    PERFORM setval('opendolphin.hibernate_sequence', max_id, true);
END $$;
