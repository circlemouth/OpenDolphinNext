SET search_path TO opendolphin, public;

ALTER TABLE d_orca_user_link
    ADD COLUMN IF NOT EXISTS facility_id VARCHAR(64);

UPDATE d_orca_user_link l
   SET facility_id = split_part(u.userid, ':', 1)
  FROM d_users u
 WHERE l.ehr_user_pk = u.id
   AND (l.facility_id IS NULL OR l.facility_id = '');

ALTER TABLE d_orca_user_link
    ALTER COLUMN facility_id SET NOT NULL;

ALTER TABLE d_orca_user_link
    DROP CONSTRAINT IF EXISTS d_orca_user_link_pkey;

ALTER TABLE d_orca_user_link
    ADD CONSTRAINT d_orca_user_link_pkey PRIMARY KEY (facility_id, ehr_user_pk);

ALTER TABLE d_orca_user_link
    DROP CONSTRAINT IF EXISTS uq_orca_user_link_orca_user_id;

DROP INDEX IF EXISTS uq_d_orca_user_link_orca_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_d_orca_user_link_facility_orca_user
    ON d_orca_user_link (facility_id, orca_user_id);
