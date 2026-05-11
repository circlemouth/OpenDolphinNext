ALTER TABLE opendolphin.chart_revision
    ADD COLUMN IF NOT EXISTS snapshot_manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb;
