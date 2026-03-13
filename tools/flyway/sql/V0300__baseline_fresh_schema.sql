-- Fresh-deploy baseline for the modernized OpenDolphin schema.
-- This baseline reflects the final schema only:
-- - opendolphin schema only
-- - no public fallback
-- - no staged migration/backfill/repair logic
-- - d_module / d_health_insurance are JSON-only
-- - d_attachment / d_image are external-storage only

CREATE SCHEMA IF NOT EXISTS opendolphin;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SET search_path TO opendolphin, public;

CREATE SEQUENCE IF NOT EXISTS hibernate_sequence START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS facility_num START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_users_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_audit_event_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS chart_event_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_facility_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_users_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_roles_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_patient_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_health_insurance_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_karte_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_patient_visit_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_letter_item_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_letter_text_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_letter_date_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_patient_freedocument_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_subscribed_tree_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_nlabo_module_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_nlabo_item_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_vital_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS d_stamp_tree_SEQ START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE IF NOT EXISTS d_facility (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    address VARCHAR(255) NOT NULL,
    facilityid VARCHAR(255) NOT NULL,
    facilityname VARCHAR(255) NOT NULL,
    facsimile VARCHAR(255),
    membertype VARCHAR(255) NOT NULL,
    registereddate DATE NOT NULL,
    s3accesskey VARCHAR(255),
    s3secretkey VARCHAR(255),
    s3url VARCHAR(255),
    telephone VARCHAR(255) NOT NULL,
    url VARCHAR(255),
    zipcode VARCHAR(255) NOT NULL,
    CONSTRAINT d_facility_pkey PRIMARY KEY (id),
    CONSTRAINT d_facility_facilityid_key UNIQUE (facilityid)
);

CREATE TABLE IF NOT EXISTS d_users (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.d_users_seq'::regclass),
    commonname VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    departmentcodesys VARCHAR(255),
    departmentdesc VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    factor2auth VARCHAR(255),
    givenname VARCHAR(255),
    license VARCHAR(255),
    licensecodesys VARCHAR(255),
    licensedesc VARCHAR(255),
    mainmobile VARCHAR(255),
    membertype VARCHAR(255) NOT NULL,
    memo VARCHAR(255),
    orcaid VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    registereddate DATE NOT NULL,
    sirname VARCHAR(255),
    submobile VARCHAR(255),
    usedrugid VARCHAR(255),
    userid VARCHAR(255) NOT NULL,
    facility_id BIGINT NOT NULL,
    CONSTRAINT d_users_pkey PRIMARY KEY (id),
    CONSTRAINT d_users_userid_key UNIQUE (userid),
    CONSTRAINT fk_d_users_facility FOREIGN KEY (facility_id) REFERENCES d_facility(id)
);

CREATE TABLE IF NOT EXISTS d_roles (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    c_role VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    c_user BIGINT NOT NULL,
    CONSTRAINT d_roles_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_roles_user FOREIGN KEY (c_user) REFERENCES d_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_patient (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    address VARCHAR(255),
    zipcode VARCHAR(255),
    appmemo VARCHAR(255),
    birthday DATE,
    email VARCHAR(255),
    facilityid VARCHAR(255) NOT NULL,
    familyname VARCHAR(255),
    fullname VARCHAR(255) NOT NULL,
    gender VARCHAR(255) NOT NULL,
    genderdesc VARCHAR(255),
    givenname VARCHAR(255),
    jpegphoto BYTEA,
    kanafamilyname VARCHAR(255),
    kanagivenname VARCHAR(255),
    kananame VARCHAR(255),
    maritalstatus VARCHAR(255),
    memo VARCHAR(255),
    mobilephone VARCHAR(255),
    nationality VARCHAR(255),
    owneruuid VARCHAR(255),
    patientid VARCHAR(255) NOT NULL,
    relations VARCHAR(255),
    romanfamilyname VARCHAR(255),
    romangivenname VARCHAR(255),
    romanname VARCHAR(255),
    telephone VARCHAR(255),
    CONSTRAINT d_patient_pkey PRIMARY KEY (id),
    CONSTRAINT d_patient_facility_patientid_uidx UNIQUE (facilityid, patientid)
);

CREATE TABLE IF NOT EXISTS d_health_insurance (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    bean_json JSONB NOT NULL,
    patient_id BIGINT NOT NULL,
    CONSTRAINT d_health_insurance_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_health_insurance_patient FOREIGN KEY (patient_id) REFERENCES d_patient(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_karte (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    created DATE NOT NULL,
    patient_id BIGINT NOT NULL,
    CONSTRAINT d_karte_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_karte_patient FOREIGN KEY (patient_id) REFERENCES d_patient(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_patient_visit (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    department VARCHAR(255),
    deptcode VARCHAR(255),
    deptname VARCHAR(255),
    doctorid VARCHAR(255),
    doctorname VARCHAR(255),
    facilityid VARCHAR(255) NOT NULL,
    firstinsurance VARCHAR(255),
    insuranceuid VARCHAR(255),
    jmarinumber VARCHAR(255),
    memo VARCHAR(255),
    pvtdate TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    status INTEGER NOT NULL,
    patient_id BIGINT NOT NULL,
    CONSTRAINT d_patient_visit_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_patient_visit_patient FOREIGN KEY (patient_id) REFERENCES d_patient(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_document (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    docid VARCHAR(32) NOT NULL,
    doctype VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    purpose VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    departmentdesc VARCHAR(255),
    healthinsurance VARCHAR(255),
    healthinsurancedesc VARCHAR(255),
    healthinsuranceguid VARCHAR(255),
    hasmark BOOLEAN NOT NULL DEFAULT FALSE,
    hasimage BOOLEAN NOT NULL DEFAULT FALSE,
    hasrp BOOLEAN NOT NULL DEFAULT FALSE,
    hastreatment BOOLEAN NOT NULL DEFAULT FALSE,
    haslabotest BOOLEAN NOT NULL DEFAULT FALSE,
    versionnumber VARCHAR(255),
    parentid VARCHAR(255),
    parentidrelation VARCHAR(255),
    labtestordernumber VARCHAR(255),
    admflag VARCHAR(1),
    CONSTRAINT d_document_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_document_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_document_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_module (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    stampnumber INTEGER NOT NULL,
    entity VARCHAR(255) NOT NULL,
    performflag VARCHAR(1),
    bean_json JSONB NOT NULL,
    doc_id BIGINT NOT NULL,
    CONSTRAINT d_module_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_module_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_module_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE,
    CONSTRAINT fk_d_module_document FOREIGN KEY (doc_id) REFERENCES d_document(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_image (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    contenttype VARCHAR(255) NOT NULL,
    medicalrole VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    href VARCHAR(255) NOT NULL,
    bucket VARCHAR(255),
    sop VARCHAR(255),
    url VARCHAR(255),
    facilityid VARCHAR(255),
    imagetime VARCHAR(255),
    bodypart VARCHAR(255),
    shutternum VARCHAR(255),
    seqnum VARCHAR(255),
    extension VARCHAR(255),
    uri VARCHAR(255) NOT NULL,
    digest VARCHAR(255) NOT NULL,
    doc_id BIGINT NOT NULL,
    CONSTRAINT d_image_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_image_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_image_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE,
    CONSTRAINT fk_d_image_document FOREIGN KEY (doc_id) REFERENCES d_document(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_attachment (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    filename VARCHAR(255),
    contenttype VARCHAR(255),
    contentsize BIGINT,
    lastmodified BIGINT,
    digest VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    uri VARCHAR(255) NOT NULL,
    extension VARCHAR(255),
    memo TEXT,
    doc_id BIGINT NOT NULL,
    CONSTRAINT d_attachment_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_attachment_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_attachment_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE,
    CONSTRAINT fk_d_attachment_document FOREIGN KEY (doc_id) REFERENCES d_document(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_diagnosis (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    department VARCHAR(255),
    departmentdesc VARCHAR(255),
    diagnosis VARCHAR(255) NOT NULL,
    diagnosiscategory VARCHAR(255),
    diagnosiscategorycodesys VARCHAR(255),
    diagnosiscategorydesc VARCHAR(255),
    diagnosiscode VARCHAR(255),
    diagnosiscodesystem VARCHAR(255),
    outcome VARCHAR(255),
    outcomecodesys VARCHAR(255),
    outcomedesc VARCHAR(255),
    firstencounterdate VARCHAR(255),
    relatedhealthinsurance VARCHAR(255),
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    CONSTRAINT d_diagnosis_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_diagnosis_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_diagnosis_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_observation (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    observation VARCHAR(255) NOT NULL,
    phenomenon VARCHAR(255) NOT NULL,
    c_value VARCHAR(255),
    unit VARCHAR(255),
    categoryvalue VARCHAR(255),
    valuedesc VARCHAR(255),
    valuesys VARCHAR(255),
    memo VARCHAR(255),
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    CONSTRAINT d_observation_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_observation_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_observation_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_patient_memo (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    memo VARCHAR(255),
    memo2 TEXT,
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    CONSTRAINT d_patient_memo_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_patient_memo_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_patient_memo_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_patient_freedocument (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    facilitypatid VARCHAR(255) NOT NULL,
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    comment TEXT,
    CONSTRAINT d_patient_freedocument_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS d_letter (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    doctype VARCHAR(31) NOT NULL,
    payloadbytes BYTEA NOT NULL,
    CONSTRAINT d_letter_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_letter_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_letter_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_letter_module (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    title VARCHAR(255),
    lettertype VARCHAR(255),
    handleclass VARCHAR(255),
    clienthospital VARCHAR(255),
    clientdept VARCHAR(255),
    clientdoctor VARCHAR(255),
    clientzipcode VARCHAR(255),
    clientaddress VARCHAR(255),
    clienttelephone VARCHAR(255),
    clientfax VARCHAR(255),
    consultanthospital VARCHAR(255),
    consultantdept VARCHAR(255),
    consultantdoctor VARCHAR(255),
    consultantzipcode VARCHAR(255),
    consultantaddress VARCHAR(255),
    consultanttelephone VARCHAR(255),
    consultantfax VARCHAR(255),
    patientid VARCHAR(255),
    patientname VARCHAR(255),
    patientkana VARCHAR(255),
    patientgender VARCHAR(255),
    patientbirthday VARCHAR(255),
    patientage VARCHAR(255),
    patientoccupation VARCHAR(255),
    patientzipcode VARCHAR(255),
    patientaddress VARCHAR(255),
    patienttelephone VARCHAR(255),
    patientmobilephone VARCHAR(255),
    patientfaxnumber VARCHAR(255),
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    CONSTRAINT d_letter_module_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_letter_module_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_letter_module_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_letter_item (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    name VARCHAR(255) NOT NULL,
    c_value VARCHAR(255),
    module_id BIGINT NOT NULL,
    CONSTRAINT d_letter_item_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_letter_item_module FOREIGN KEY (module_id) REFERENCES d_letter_module(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_letter_text (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    name VARCHAR(255) NOT NULL,
    textvalue TEXT,
    module_id BIGINT NOT NULL,
    CONSTRAINT d_letter_text_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_letter_text_module FOREIGN KEY (module_id) REFERENCES d_letter_module(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_letter_date (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    name VARCHAR(255) NOT NULL,
    c_value DATE,
    module_id BIGINT NOT NULL,
    CONSTRAINT d_letter_date_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_letter_date_module FOREIGN KEY (module_id) REFERENCES d_letter_module(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_nlabo_module (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    labocentercode VARCHAR(255),
    modulekey VARCHAR(255),
    numofitems VARCHAR(255),
    patientid VARCHAR(255) NOT NULL,
    patientname VARCHAR(255),
    patientsex VARCHAR(255),
    reportformat VARCHAR(255),
    sampledate VARCHAR(255),
    CONSTRAINT d_nlabo_module_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS d_nlabo_item (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    patientid VARCHAR(255) NOT NULL,
    sampledate VARCHAR(255) NOT NULL,
    labocode VARCHAR(255),
    lipemia VARCHAR(255),
    hemolysis VARCHAR(255),
    dialysis VARCHAR(255),
    reportstatus VARCHAR(255),
    groupcode VARCHAR(255) NOT NULL,
    groupname VARCHAR(255),
    parentcode VARCHAR(255) NOT NULL,
    itemcode VARCHAR(255) NOT NULL,
    mediscode VARCHAR(255),
    itemname VARCHAR(255) NOT NULL,
    abnormalflg VARCHAR(255),
    normalvalue VARCHAR(255),
    c_value VARCHAR(255),
    unit VARCHAR(255),
    specimencode VARCHAR(255),
    specimenname VARCHAR(255),
    commentcode1 VARCHAR(255),
    comment1 VARCHAR(255),
    commentcode2 VARCHAR(255),
    comment2 VARCHAR(255),
    sortkey VARCHAR(255),
    labomodule_id BIGINT NOT NULL,
    CONSTRAINT d_nlabo_item_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_nlabo_item_module FOREIGN KEY (labomodule_id) REFERENCES d_nlabo_module(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_stamp_tree (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    category VARCHAR(255),
    description VARCHAR(255),
    lastupdated DATE,
    tree_name VARCHAR(255) NOT NULL,
    partyname VARCHAR(255),
    publishtype VARCHAR(255),
    published VARCHAR(255),
    publisheddate DATE,
    treebytes BYTEA NOT NULL,
    url VARCHAR(255),
    versionnumber VARCHAR(255),
    user_id BIGINT NOT NULL,
    CONSTRAINT d_stamp_tree_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_stamp_tree_user FOREIGN KEY (user_id) REFERENCES d_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_published_tree (
    id BIGINT NOT NULL,
    category VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    lastupdated DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    partyname VARCHAR(255) NOT NULL,
    publishtype VARCHAR(255) NOT NULL,
    publisheddate DATE NOT NULL,
    treebytes BYTEA NOT NULL,
    url VARCHAR(255) NOT NULL,
    user_id BIGINT NOT NULL,
    CONSTRAINT d_published_tree_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_published_tree_user FOREIGN KEY (user_id) REFERENCES d_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_subscribed_tree (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    treeid BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    CONSTRAINT d_subscribed_tree_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_subscribed_tree_user FOREIGN KEY (user_id) REFERENCES d_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_stamp (
    id VARCHAR(255) NOT NULL,
    entity VARCHAR(255) NOT NULL,
    stampbytes BYTEA NOT NULL,
    userid BIGINT NOT NULL,
    CONSTRAINT d_stamp_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS d_first_encounter (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    payloadbytes BYTEA NOT NULL,
    doctype VARCHAR(255),
    CONSTRAINT d_first_encounter_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_first_encounter_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_first_encounter_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_nurse_progress_course (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    progresstext TEXT,
    textlength INTEGER NOT NULL,
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    CONSTRAINT d_nurse_progress_course_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_nurse_progress_course_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_nurse_progress_course_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_ondoban (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    dayindex INTEGER NOT NULL,
    memo VARCHAR(255),
    seriesindex INTEGER NOT NULL,
    seriesname VARCHAR(255) NOT NULL,
    unit VARCHAR(255),
    c_value REAL NOT NULL,
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    CONSTRAINT d_ondoban_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_ondoban_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_ondoban_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_vital (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    algia VARCHAR(255),
    bloodpressurediastolic VARCHAR(255),
    bloodpressuresystolic VARCHAR(255),
    bodytemperature VARCHAR(255),
    egestion VARCHAR(255),
    facilitypatid VARCHAR(255) NOT NULL,
    feel VARCHAR(255),
    height VARCHAR(255),
    karteid VARCHAR(255),
    meal VARCHAR(255),
    ps VARCHAR(255),
    pulserate VARCHAR(255),
    respirationrate VARCHAR(255),
    savedate VARCHAR(255),
    sleep VARCHAR(255),
    spo2 VARCHAR(255),
    vitaldate VARCHAR(255),
    vitaltime VARCHAR(255),
    weight VARCHAR(255),
    CONSTRAINT d_vital_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS d_factor2_device (
    id BIGSERIAL PRIMARY KEY,
    devicename VARCHAR(255),
    entrydate VARCHAR(255),
    macaddress VARCHAR(255),
    userpk BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS d_factor2_code (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(255),
    mobilenumber VARCHAR(255),
    userpk BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS d_factor2_backupkey (
    id BIGSERIAL PRIMARY KEY,
    backupkey VARCHAR(255),
    created_at TIMESTAMPTZ,
    hash_algorithm VARCHAR(32),
    userpk BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS d_factor2_challenge (
    id BIGSERIAL PRIMARY KEY,
    user_pk BIGINT NOT NULL,
    challenge_type VARCHAR(64) NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    challenge_payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    rp_id VARCHAR(255),
    origin VARCHAR(512),
    CONSTRAINT d_factor2_challenge_request_id_key UNIQUE (request_id)
);

CREATE TABLE IF NOT EXISTS d_factor2_credential (
    id BIGSERIAL PRIMARY KEY,
    user_pk BIGINT NOT NULL,
    credential_type VARCHAR(32) NOT NULL,
    label VARCHAR(255),
    credential_id VARCHAR(512),
    public_key TEXT,
    secret TEXT,
    sign_count BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    transports TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS d_audit_event (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.d_audit_event_id_seq'::regclass),
    event_time TIMESTAMPTZ NOT NULL,
    actor_id VARCHAR(128),
    actor_display_name VARCHAR(255),
    actor_role VARCHAR(128),
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(255),
    patient_id VARCHAR(64),
    request_id VARCHAR(64),
    trace_id VARCHAR(64),
    run_id VARCHAR(64),
    screen VARCHAR(255),
    ui_action VARCHAR(64),
    ip_address VARCHAR(64),
    user_agent VARCHAR(512),
    outcome VARCHAR(32),
    payload_hash VARCHAR(128) NOT NULL,
    previous_hash VARCHAR(128),
    event_hash VARCHAR(128) NOT NULL,
    payload TEXT,
    CONSTRAINT d_audit_event_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS chart_event_history (
    event_id BIGINT NOT NULL,
    facility_id VARCHAR(64) NOT NULL,
    issuer_uuid VARCHAR(64),
    event_type INTEGER,
    payload_json TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chart_event_history_pkey PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS d_user_access_profile (
    user_pk BIGINT NOT NULL,
    sex VARCHAR(1),
    staff_role VARCHAR(32),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    CONSTRAINT d_user_access_profile_pkey PRIMARY KEY (user_pk),
    CONSTRAINT fk_d_user_access_profile_user FOREIGN KEY (user_pk) REFERENCES d_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS d_auth_account_failure (
    facility_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    fail_count INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lock_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT d_auth_account_failure_pkey PRIMARY KEY (facility_id, user_id)
);

CREATE TABLE IF NOT EXISTS d_auth_ip_failure (
    client_ip VARCHAR(64) NOT NULL,
    fail_count INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    throttle_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT d_auth_ip_failure_pkey PRIMARY KEY (client_ip)
);

CREATE TABLE IF NOT EXISTS d_orca_user_link (
    ehr_user_pk BIGINT NOT NULL,
    orca_user_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(255),
    CONSTRAINT d_orca_user_link_pkey PRIMARY KEY (ehr_user_pk),
    CONSTRAINT uq_orca_user_link_orca_user_id UNIQUE (orca_user_id),
    CONSTRAINT fk_orca_user_link_user FOREIGN KEY (ehr_user_pk) REFERENCES d_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orca_prescription_orders (
    id BIGSERIAL PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    encounter_id VARCHAR(128),
    encounter_date DATE,
    perform_date DATE,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(128)
);

CREATE TABLE IF NOT EXISTS d_document_integrity (
    document_id BIGINT NOT NULL,
    seal_version VARCHAR(16) NOT NULL,
    hash_alg VARCHAR(32) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    seal_alg VARCHAR(32) NOT NULL,
    seal VARCHAR(64) NOT NULL,
    key_id VARCHAR(128) NOT NULL,
    sealed_at TIMESTAMPTZ NOT NULL,
    sealed_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT d_document_integrity_pkey PRIMARY KEY (document_id),
    CONSTRAINT fk_d_document_integrity_document FOREIGN KEY (document_id) REFERENCES d_document(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS d_karte_patient_id_idx ON d_karte (patient_id);
CREATE INDEX IF NOT EXISTS d_document_idx ON d_document (karte_id);
CREATE INDEX IF NOT EXISTS d_document_karte_started_status_idx ON d_document (karte_id, started DESC, status);
CREATE INDEX IF NOT EXISTS d_module_doc_idx ON d_module (doc_id);
CREATE INDEX IF NOT EXISTS d_module_karte_entity_started_idx ON d_module (karte_id, entity, started DESC);
CREATE INDEX IF NOT EXISTS d_module_entity_started_idx ON d_module (entity, started DESC);
CREATE INDEX IF NOT EXISTS d_image_doc_idx ON d_image (doc_id);
CREATE INDEX IF NOT EXISTS d_attachment_doc_idx ON d_attachment (doc_id);
CREATE INDEX IF NOT EXISTS d_diagnosis_idx ON d_diagnosis (karte_id);
CREATE INDEX IF NOT EXISTS idx_registered_diagnosis_karte_started ON d_diagnosis (karte_id, started DESC);
CREATE INDEX IF NOT EXISTS d_letter_module_idx ON d_letter_module (karte_id);
CREATE INDEX IF NOT EXISTS d_nlabo_module_pid_idx ON d_nlabo_module (patientid, sampledate DESC);
CREATE INDEX IF NOT EXISTS d_nlabo_item_module_idx ON d_nlabo_item (labomodule_id);
CREATE INDEX IF NOT EXISTS d_nlabo_item_patient_idx ON d_nlabo_item (patientid, sampledate DESC);
CREATE INDEX IF NOT EXISTS d_stamp_tree_user_idx ON d_stamp_tree (user_id);
CREATE INDEX IF NOT EXISTS d_patient_visit_facility_date_idx ON d_patient_visit (facilityid, pvtdate);
CREATE INDEX IF NOT EXISTS d_patient_visit_patient_idx ON d_patient_visit (patient_id);
CREATE INDEX IF NOT EXISTS d_patient_visit_facility_date_status_idx ON d_patient_visit (facilityid, pvtdate, status);
CREATE INDEX IF NOT EXISTS d_patient_kana_name_trgm_idx ON d_patient USING gin (kananame gin_trgm_ops);
CREATE INDEX IF NOT EXISTS d_patient_full_name_trgm_idx ON d_patient USING gin (fullname gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_factor2_challenge_user ON d_factor2_challenge (user_pk);
CREATE INDEX IF NOT EXISTS idx_factor2_challenge_type ON d_factor2_challenge (challenge_type);
CREATE INDEX IF NOT EXISTS idx_factor2_credential_user ON d_factor2_credential (user_pk);
CREATE INDEX IF NOT EXISTS idx_factor2_credential_id ON d_factor2_credential (credential_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_time ON d_audit_event (event_time);
CREATE INDEX IF NOT EXISTS idx_audit_event_action ON d_audit_event (action);
CREATE INDEX IF NOT EXISTS idx_audit_event_trace_id ON d_audit_event (trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_run_id ON d_audit_event (run_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_screen ON d_audit_event (screen);
CREATE INDEX IF NOT EXISTS idx_audit_event_ui_action ON d_audit_event (ui_action);
CREATE INDEX IF NOT EXISTS idx_audit_event_outcome ON d_audit_event (outcome);
CREATE INDEX IF NOT EXISTS idx_chart_event_history_facility_event ON chart_event_history (facility_id, event_id);
CREATE INDEX IF NOT EXISTS idx_chart_event_history_created_at ON chart_event_history (created_at);
CREATE INDEX IF NOT EXISTS idx_auth_account_failure_lock_until ON d_auth_account_failure (lock_until);
CREATE INDEX IF NOT EXISTS idx_auth_account_failure_updated_at ON d_auth_account_failure (updated_at);
CREATE INDEX IF NOT EXISTS idx_auth_ip_failure_throttle_until ON d_auth_ip_failure (throttle_until);
CREATE INDEX IF NOT EXISTS idx_auth_ip_failure_updated_at ON d_auth_ip_failure (updated_at);
CREATE INDEX IF NOT EXISTS idx_orca_prescription_orders_patient_latest
    ON orca_prescription_orders (facility_id, patient_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orca_prescription_orders_encounter_date_latest
    ON orca_prescription_orders (facility_id, patient_id, encounter_date, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orca_prescription_orders_encounter_id_latest
    ON orca_prescription_orders (facility_id, patient_id, encounter_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS d_document_integrity_sealed_at_idx ON d_document_integrity (sealed_at);

CREATE TABLE IF NOT EXISTS d_appo (
    id BIGINT NOT NULL DEFAULT nextval('opendolphin.hibernate_sequence'::regclass),
    confirmed TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    started TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended TIMESTAMP WITHOUT TIME ZONE,
    recorded TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    linkid BIGINT NOT NULL DEFAULT 0,
    linkrelation VARCHAR(255),
    status VARCHAR(1) NOT NULL DEFAULT 'F',
    creator_id BIGINT NOT NULL,
    karte_id BIGINT NOT NULL,
    patientid VARCHAR(255),
    c_name VARCHAR(255) NOT NULL,
    memo VARCHAR(255),
    c_date DATE NOT NULL,
    CONSTRAINT d_appo_pkey PRIMARY KEY (id),
    CONSTRAINT fk_d_appo_creator FOREIGN KEY (creator_id) REFERENCES d_users(id),
    CONSTRAINT fk_d_appo_karte FOREIGN KEY (karte_id) REFERENCES d_karte(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS d_appo_karte_date_idx ON d_appo (karte_id, c_date);
CREATE INDEX IF NOT EXISTS d_appo_patient_idx ON d_appo (patientid);
