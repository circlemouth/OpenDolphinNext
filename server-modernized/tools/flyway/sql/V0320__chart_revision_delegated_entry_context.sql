ALTER TABLE opendolphin.chart_revision
    ADD COLUMN IF NOT EXISTS entry_mode VARCHAR(16) NOT NULL DEFAULT 'DIRECT',
    ADD COLUMN IF NOT EXISTS delegated_by_user_id BIGINT REFERENCES opendolphin.d_users(id) ON DELETE RESTRICT;

ALTER TABLE opendolphin.chart_revision
    ADD CONSTRAINT ck_chart_revision_entry_mode CHECK (entry_mode IN ('DIRECT', 'DELEGATED'));

ALTER TABLE opendolphin.chart_revision
    ADD CONSTRAINT ck_chart_revision_delegated_entry_context CHECK (
        (entry_mode = 'DIRECT' AND delegated_by_user_id IS NULL)
        OR (entry_mode = 'DELEGATED' AND delegated_by_user_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_chart_revision_entry_mode
    ON opendolphin.chart_revision (entry_mode, delegated_by_user_id);
