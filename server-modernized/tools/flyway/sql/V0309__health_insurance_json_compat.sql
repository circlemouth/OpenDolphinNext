ALTER TABLE d_health_insurance
    ADD COLUMN IF NOT EXISTS bean_json JSONB;

UPDATE d_health_insurance
SET bean_json = '{}'::jsonb
WHERE bean_json IS NULL;

ALTER TABLE d_health_insurance
    ALTER COLUMN bean_json SET NOT NULL;
