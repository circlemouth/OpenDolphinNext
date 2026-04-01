ALTER TABLE opendolphin.d_attachment
    ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32),
    ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(255),
    ADD COLUMN IF NOT EXISTS storage_key VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS storage_version_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS storage_etag VARCHAR(255);

ALTER TABLE opendolphin.d_image
    ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32),
    ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(255),
    ADD COLUMN IF NOT EXISTS storage_key VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS storage_version_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS storage_etag VARCHAR(255);
