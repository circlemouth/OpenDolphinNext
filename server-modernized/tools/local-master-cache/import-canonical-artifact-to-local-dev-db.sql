\set ON_ERROR_STOP on
SET statement_timeout = 0;
SET lock_timeout = '30s';

BEGIN;

ALTER TABLE opendolphin.local_orca_master_dataset
    DROP CONSTRAINT IF EXISTS local_orca_master_dataset_source_kind_ck;
ALTER TABLE opendolphin.local_orca_master_dataset
    ADD CONSTRAINT local_orca_master_dataset_source_kind_ck CHECK (
        source_kind IN ('official-file', 'official-api', 'manual-upload', 'fixture-dev', 'local-cache',
                        'orca-db-container-artifact')
    );

CREATE TEMP TABLE tmp_local_orca_master_cache (
    "recordType" text,
    "masterType" text,
    code text,
    name text,
    kana text,
    category text,
    unit text,
    price text,
    "validFrom" text,
    "validTo" text,
    "masterVersion" text,
    note text,
    "searchText" text,
    "payloadJson" text,
    "setCode" text,
    entity text,
    kind text,
    "classCode" text,
    "className" text,
    "itemCount" text,
    seq text,
    quantity text,
    memo text,
    "rowRole" text,
    "rowSubtype" text,
    code2 text,
    "interactionCode" text,
    "interactionName" text,
    message text
) ON COMMIT DROP;

COPY tmp_local_orca_master_cache FROM :'csv_path' WITH (FORMAT csv, HEADER true);

DO $$
DECLARE
    missing text;
BEGIN
    SELECT string_agg(required.master_type, ', ' ORDER BY required.master_type)
      INTO missing
      FROM (VALUES
          ('address'), ('bodypart'), ('comment'), ('disease-candidate'), ('drug'), ('etensu'),
          ('generic-class'), ('generic-price'), ('hokenja'), ('kensa-sort'), ('material'),
          ('order-inputsets'), ('order-interactions'), ('youhou')
      ) AS required(master_type)
      WHERE NOT EXISTS (
          SELECT 1
            FROM tmp_local_orca_master_cache t
           WHERE t."masterType" = required.master_type
      );
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'local master cache artifact missing required master types: %', missing;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM tmp_local_orca_master_cache
         WHERE COALESCE(NULLIF("recordType", ''), '') = ''
            OR COALESCE(NULLIF("masterType", ''), '') = ''
    ) THEN
        RAISE EXCEPTION 'local master cache artifact contains blank recordType/masterType';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM tmp_local_orca_master_cache
         WHERE "recordType" = 'entry'
           AND (COALESCE(NULLIF(code, ''), '') = '' OR COALESCE(NULLIF(name, ''), '') = '')
    ) THEN
        RAISE EXCEPTION 'local master cache artifact contains blank entry code/name';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM tmp_local_orca_master_cache
         WHERE "recordType" = 'inputset'
           AND (COALESCE(NULLIF("setCode", ''), '') = '' OR COALESCE(NULLIF(name, ''), '') = '')
    ) THEN
        RAISE EXCEPTION 'local master cache artifact contains blank inputset setCode/name';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM tmp_local_orca_master_cache
         WHERE "recordType" = 'inputsetItem'
           AND (COALESCE(NULLIF("setCode", ''), '') = ''
                OR COALESCE(NULLIF(seq, ''), '') = ''
                OR COALESCE(NULLIF(code, ''), '') = ''
                OR COALESCE(NULLIF(name, ''), '') = '')
    ) THEN
        RAISE EXCEPTION 'local master cache artifact contains blank inputset item required value';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM tmp_local_orca_master_cache
         WHERE "recordType" = 'interaction'
           AND (COALESCE(NULLIF(code, ''), '') = '' OR COALESCE(NULLIF(code2, ''), '') = '')
    ) THEN
        RAISE EXCEPTION 'local master cache artifact contains blank interaction code/code2';
    END IF;
END $$;

INSERT INTO opendolphin.local_orca_master_dataset (
    master_type, source_system, source_kind, source_api, source_file, master_version,
    effective_from, effective_to, imported_at, stale, unavailable_reason, cache_status, read_only
)
SELECT
    "masterType",
    'OpenDolphinLocalMasterCache',
    'orca-db-container-artifact',
    NULL,
    :'source_file',
    COALESCE(NULLIF(max("masterVersion"), ''), :'master_version'),
    COALESCE(NULLIF(min(NULLIF("validFrom", '')), ''), '00000000'),
    COALESCE(NULLIF(max(NULLIF("validTo", '')), ''), '99991231'),
    CURRENT_TIMESTAMP,
    FALSE,
    NULL,
    'CURRENT',
    TRUE
FROM tmp_local_orca_master_cache
GROUP BY "masterType"
ON CONFLICT (master_type) DO UPDATE SET
    source_system = EXCLUDED.source_system,
    source_kind = EXCLUDED.source_kind,
    source_api = EXCLUDED.source_api,
    source_file = EXCLUDED.source_file,
    master_version = EXCLUDED.master_version,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to,
    imported_at = EXCLUDED.imported_at,
    stale = FALSE,
    unavailable_reason = NULL,
    cache_status = 'CURRENT',
    read_only = TRUE;

DELETE FROM opendolphin.local_orca_master_interaction;
DELETE FROM opendolphin.local_orca_master_inputset_item;
DELETE FROM opendolphin.local_orca_master_inputset;
DELETE FROM opendolphin.local_orca_master_entry
 WHERE master_type IN (
       SELECT DISTINCT "masterType"
         FROM tmp_local_orca_master_cache
        WHERE "recordType" = 'entry'
 );

INSERT INTO opendolphin.local_orca_master_entry (
    master_type, code, name, kana, category, unit, price, valid_from, valid_to,
    master_version, note, search_text, payload_json, read_only
)
SELECT DISTINCT ON ("masterType", code, COALESCE(NULLIF("validFrom", ''), '00000000'), COALESCE(NULLIF("validTo", ''), '99991231'))
    "masterType",
    code,
    name,
    NULLIF(kana, ''),
    NULLIF(category, ''),
    NULLIF(unit, ''),
    CASE WHEN price ~ '^-?[0-9]+(\.[0-9]+)?$' THEN price::numeric ELSE NULL END,
    COALESCE(NULLIF("validFrom", ''), '00000000'),
    COALESCE(NULLIF("validTo", ''), '99991231'),
    NULLIF("masterVersion", ''),
    NULLIF(note, ''),
    lower(COALESCE(NULLIF("searchText", ''), concat_ws(' ', code, name, kana))),
    COALESCE(NULLIF("payloadJson", ''), '{}')::jsonb,
    TRUE
FROM tmp_local_orca_master_cache
WHERE "recordType" = 'entry'
ORDER BY "masterType", code, COALESCE(NULLIF("validFrom", ''), '00000000'), COALESCE(NULLIF("validTo", ''), '99991231');

INSERT INTO opendolphin.local_orca_master_inputset (
    set_code, name, entity, kind, class_code, class_name, item_count, valid_from, valid_to,
    master_version, search_text, read_only
)
SELECT DISTINCT ON ("setCode")
    "setCode",
    name,
    NULLIF(entity, ''),
    NULLIF(kind, ''),
    NULLIF("classCode", ''),
    NULLIF("className", ''),
    CASE WHEN "itemCount" ~ '^[0-9]+$' THEN "itemCount"::integer ELSE 0 END,
    COALESCE(NULLIF("validFrom", ''), '00000000'),
    COALESCE(NULLIF("validTo", ''), '99991231'),
    NULLIF("masterVersion", ''),
    lower(COALESCE(NULLIF("searchText", ''), concat_ws(' ', "setCode", name))),
    TRUE
FROM tmp_local_orca_master_cache
WHERE "recordType" = 'inputset'
ORDER BY "setCode";

INSERT INTO opendolphin.local_orca_master_inputset_item (
    set_code, seq, code, name, quantity, unit, memo, row_role, row_subtype,
    category, valid_from, valid_to, read_only
)
SELECT DISTINCT ON ("setCode", CASE WHEN seq ~ '^[0-9]+$' THEN seq::integer ELSE 0 END)
    "setCode",
    CASE WHEN seq ~ '^[0-9]+$' THEN seq::integer ELSE 0 END,
    code,
    name,
    NULLIF(quantity, ''),
    NULLIF(unit, ''),
    NULLIF(memo, ''),
    COALESCE(NULLIF("rowRole", ''), 'main'),
    NULLIF("rowSubtype", ''),
    NULLIF(category, ''),
    COALESCE(NULLIF("validFrom", ''), '00000000'),
    COALESCE(NULLIF("validTo", ''), '99991231'),
    TRUE
FROM tmp_local_orca_master_cache
WHERE "recordType" = 'inputsetItem'
ORDER BY "setCode", CASE WHEN seq ~ '^[0-9]+$' THEN seq::integer ELSE 0 END;

INSERT INTO opendolphin.local_orca_master_interaction (
    code1, code2, interaction_code, interaction_name, message, valid_from, valid_to, master_version, read_only
)
SELECT DISTINCT ON (code, code2, COALESCE(NULLIF("interactionCode", ''), ''))
    code,
    code2,
    NULLIF("interactionCode", ''),
    NULLIF("interactionName", ''),
    NULLIF(message, ''),
    COALESCE(NULLIF("validFrom", ''), '00000000'),
    COALESCE(NULLIF("validTo", ''), '99991231'),
    NULLIF("masterVersion", ''),
    TRUE
FROM tmp_local_orca_master_cache
WHERE "recordType" = 'interaction'
ORDER BY code, code2, COALESCE(NULLIF("interactionCode", ''), '');

ANALYZE opendolphin.local_orca_master_dataset;
ANALYZE opendolphin.local_orca_master_entry;
ANALYZE opendolphin.local_orca_master_inputset;
ANALYZE opendolphin.local_orca_master_inputset_item;
ANALYZE opendolphin.local_orca_master_interaction;

WITH vars AS (
    SELECT :'version_id' AS version_id,
           :'artifact_sha256' AS hash,
           :'artifact_path' AS artifact_path,
           :'run_id' AS run_id,
           :'master_version' AS master_version,
           (SELECT count(*) FROM tmp_local_orca_master_cache)::bigint AS record_count,
           (SELECT max(imported_at) FROM opendolphin.local_orca_master_dataset
             WHERE source_kind = 'orca-db-container-artifact') AS imported_at
), version AS (
    SELECT jsonb_build_object(
        'versionId', version_id,
        'capturedAt', to_char(imported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'status', 'success',
        'hash', hash,
        'recordCount', record_count,
        'artifactPath', artifact_path,
        'sourceUrl', 'local-orca-db-container-artifact',
        'summary', 'ORCA DB container canonical artifact imported into local master cache',
        'triggerType', 'LOCAL_DB_CONTAINER_ETL',
        'requestedBy', 'system:local-etl',
        'runId', run_id,
        'addedCount', record_count,
        'removedCount', 0,
        'changedCount', 0,
        'note', 'sourceKind=orca-db-container-artifact; sanitized metadata only',
        'current', true
    ) AS body
    FROM vars
), updated_dataset AS (
    SELECT (
        payload_json #> '{datasets,local_orca_master_cache}'
    ) || jsonb_build_object(
        'status', 'idle',
        'lastCheckedAt', to_char(vars.imported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'lastSuccessfulAt', to_char(vars.imported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'lastFailureAt', NULL,
        'lastFailureReason', NULL,
        'latestRunId', vars.run_id,
        'latestJobMessage', 'local master cache rows imported from ORCA DB container artifact',
        'currentVersionId', vars.version_id,
        'currentRecordCount', vars.record_count,
        'updateDetected', false,
        'versions', jsonb_build_array(version.body)
    ) AS body
    FROM opendolphin.runtime_state_store, vars, version
    WHERE state_category = 'master_update' AND state_key = 'default'
)
UPDATE opendolphin.runtime_state_store
   SET payload_json = jsonb_set(
           jsonb_set(payload_json, '{datasets,local_orca_master_cache}', updated_dataset.body, true),
           '{updatedAt}', to_jsonb(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true
       ),
       updated_at = CURRENT_TIMESTAMP
  FROM updated_dataset
 WHERE state_category = 'master_update' AND state_key = 'default';

COMMIT;
