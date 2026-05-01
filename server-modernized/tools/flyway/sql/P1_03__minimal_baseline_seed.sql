-- P1-03 minimal baseline dataset for characterization tests.
-- Manual seed script (non-versioned): apply explicitly via psql.

BEGIN;
SET search_path = opendolphin, public;

-- Ensure deterministic fixture identity.
DELETE FROM d_attachment WHERE doc_id IN (9102001, 9102002, 9102003, 9102004);
DELETE FROM d_image WHERE doc_id IN (9102001, 9102002, 9102003, 9102004);
DELETE FROM d_module WHERE doc_id IN (9102001, 9102002, 9102003, 9102004);
DELETE FROM d_document WHERE id IN (9102001, 9102002, 9102003, 9102004);
DELETE FROM d_health_insurance WHERE patient_id IN (9101001, 9101002, 9101003);
DELETE FROM d_patient_visit WHERE patient_id IN (9101001, 9101002, 9101003);
DELETE FROM d_karte WHERE id IN (9101101, 9101102, 9101103);
DELETE FROM d_patient WHERE id IN (9101001, 9101002, 9101003);
DELETE FROM d_roles WHERE c_user = 9100101;
DELETE FROM d_users WHERE id = 9100101;
DELETE FROM d_facility WHERE id = 9100001;

INSERT INTO d_facility (
    id, facilityid, facilityname, membertype, registereddate, zipcode, address, telephone
) VALUES (
    9100001,
    'P1.03.FACILITY.0001',
    'P1-03 Baseline Clinic',
    'PROCESS',
    DATE '2026-03-10',
    '100-0001',
    'Tokyo Chiyoda 1-1-1',
    '03-1111-0001'
);

INSERT INTO d_users (
    id, userid, password, commonname, facility_id, membertype, registereddate,
    sirname, givenname, email, license, licensedesc
) VALUES (
    9100101,
    'P1.03.FACILITY.0001:doctor1',
    'pbkdf2_sha256_v1$310000$Iy73ehQDQ6j1pqxP7fpnpw==$NQj7UL55NKB2QY+ojvhHxV+Cyr98koplDjaFo3ymyiE=', -- doctor2025
    'P1-03 Doctor One',
    9100001,
    'PROCESS',
    DATE '2026-03-10',
    'Baseline',
    'Doctor',
    'doctor1+p103@example.local',
    'MD',
    '医師'
);

INSERT INTO d_roles (id, c_role, user_id, c_user) VALUES
    (9100201, 'system-administrator', 'P1.03.FACILITY.0001:doctor1', 9100101),
    (9100202, 'doctor', 'P1.03.FACILITY.0001:doctor1', 9100101),
    (9100203, 'user', 'P1.03.FACILITY.0001:doctor1', 9100101);

INSERT INTO d_patient (
    id, facilityid, patientid, familyname, givenname, fullname,
    kanafamilyname, kanagivenname, kananame,
    gender, genderdesc, birthday, telephone, address
) VALUES
    (
        9101001, 'P1.03.FACILITY.0001', 'P1030001',
        '山田', '花子', '山田 花子',
        'ヤマダ', 'ハナコ', 'ヤマダ ハナコ',
        'F', 'female', DATE '1985-04-12', '03-1111-1001', '東京都千代田区1-1-10'
    ),
    (
        9101002, 'P1.03.FACILITY.0001', 'P1030002',
        '田中', '太郎', '田中 太郎',
        'タナカ', 'タロウ', 'タナカ タロウ',
        'M', 'male', DATE '1978-11-03', '03-1111-1002', '東京都千代田区1-1-11'
    ),
    (
        9101003, 'P1.03.FACILITY.0001', 'P1030003',
        '佐藤', '次郎', '佐藤 次郎',
        'サトウ', 'ジロウ', 'サトウ ジロウ',
        'M', 'male', DATE '1992-08-25', '03-1111-1003', '東京都千代田区1-1-12'
    );

INSERT INTO d_health_insurance (id, bean_json, patient_id) VALUES
    (
        9101201,
        '{"insuranceClass":"組合","insuranceNumber":"12345678","symbol":"12","number":"34","relationToInsured":"本人"}'::jsonb,
        9101001
    ),
    (
        9101202,
        '{"insuranceClass":"協会","insuranceNumber":"87654321","symbol":"56","number":"78","relationToInsured":"本人"}'::jsonb,
        9101002
    ),
    (
        9101203,
        '{"insuranceClass":"国保","insuranceNumber":"55552222","symbol":"90","number":"12","relationToInsured":"本人"}'::jsonb,
        9101003
    );

INSERT INTO d_karte (id, created, patient_id) VALUES
    (9101101, DATE '2026-03-10', 9101001),
    (9101102, DATE '2026-03-10', 9101002),
    (9101103, DATE '2026-03-10', 9101003);

-- Pattern 1: single SOAP chart.
INSERT INTO d_document (
    id, confirmed, started, ended, recorded,
    creator_id, karte_id, docid, doctype, title, purpose,
    status, linkid, hasrp, hastreatment, haslabotest, hasimage,
    versionnumber, parentid, parentidrelation
) VALUES (
    9102001,
    TIMESTAMP '2026-03-10 09:00:00', TIMESTAMP '2026-03-10 09:00:00', TIMESTAMP '2026-03-10 09:15:00', TIMESTAMP '2026-03-10 09:15:00',
    9100101, 9101101, 'P103-DOC-0001', 'karte', '初診SOAP', 'P',
    'F', 0, FALSE, FALSE, FALSE, FALSE,
    '1', NULL, NULL
);

-- Pattern 2: revision pair (v1 -> v2).
INSERT INTO d_document (
    id, confirmed, started, ended, recorded,
    creator_id, karte_id, docid, doctype, title, purpose,
    status, linkid, hasrp, hastreatment, haslabotest, hasimage,
    versionnumber, parentid, parentidrelation
) VALUES
    (
        9102002,
        TIMESTAMP '2026-03-10 10:00:00', TIMESTAMP '2026-03-10 10:00:00', TIMESTAMP '2026-03-10 10:20:00', TIMESTAMP '2026-03-10 10:20:00',
        9100101, 9101102, 'P103-DOC-0002', 'karte', '再診SOAP(初版)', 'P',
        'F', 0, FALSE, FALSE, FALSE, FALSE,
        '1', NULL, NULL
    ),
    (
        9102003,
        TIMESTAMP '2026-03-10 10:40:00', TIMESTAMP '2026-03-10 10:40:00', TIMESTAMP '2026-03-10 10:55:00', TIMESTAMP '2026-03-10 10:55:00',
        9100101, 9101102, 'P103-DOC-0003', 'karte', '再診SOAP(改訂版)', 'P',
        'F', 0, FALSE, FALSE, FALSE, TRUE,
        '2', 'P103-DOC-0002', 'revision'
    );

-- Pattern 3: chart linked with image/PDF attachment.
INSERT INTO d_document (
    id, confirmed, started, ended, recorded,
    creator_id, karte_id, docid, doctype, title, purpose,
    status, linkid, hasrp, hastreatment, haslabotest, hasimage,
    versionnumber, parentid, parentidrelation
) VALUES (
    9102004,
    TIMESTAMP '2026-03-10 11:15:00', TIMESTAMP '2026-03-10 11:15:00', TIMESTAMP '2026-03-10 11:30:00', TIMESTAMP '2026-03-10 11:30:00',
    9100101, 9101103, 'P103-DOC-0004', 'karte', '画像・添付連携カルテ', 'P',
    'F', 0, FALSE, FALSE, FALSE, TRUE,
    '1', NULL, NULL
);

INSERT INTO d_module (
    id, confirmed, started, ended, recorded,
    creator_id, karte_id, doc_id,
    name, role, stampnumber, entity, status, linkid,
    bean_json
) VALUES
    (
        9103001,
        TIMESTAMP '2026-03-10 09:00:00', TIMESTAMP '2026-03-10 09:00:00', TIMESTAMP '2026-03-10 09:15:00', TIMESTAMP '2026-03-10 09:15:00',
        9100101, 9101101, 9102001,
        'SOAP', 'p', 1, 'progressCourse', 'F', 0,
        '{"schemaVersion":1,"moduleType":"progressCourse","payloadJson":"{\"@class\":\"open.dolphin.infomodel.ProgressCourse\",\"freeText\":\"発熱2日\\n上気道炎\\n解熱剤頓用\"}","payloadHash":"b4753e41cc1ca54a2dfd3d54d103d53814defcf9b4293fc9a18e1cd8e75aaf7f"}'::jsonb
    ),
    (
        9103002,
        TIMESTAMP '2026-03-10 10:00:00', TIMESTAMP '2026-03-10 10:00:00', TIMESTAMP '2026-03-10 10:20:00', TIMESTAMP '2026-03-10 10:20:00',
        9100101, 9101102, 9102002,
        'SOAP', 'p', 1, 'progressCourse', 'F', 0,
        '{"schemaVersion":1,"moduleType":"progressCourse","payloadJson":"{\"@class\":\"open.dolphin.infomodel.ProgressCourse\",\"freeText\":\"咳嗽持続\\n気管支炎疑い\\n胸部X線\"}","payloadHash":"5abf04fe383c531885236a6eaefff7f09c15b940ef630155ce2f4b4688bd67d9"}'::jsonb
    ),
    (
        9103003,
        TIMESTAMP '2026-03-10 10:40:00', TIMESTAMP '2026-03-10 10:40:00', TIMESTAMP '2026-03-10 10:55:00', TIMESTAMP '2026-03-10 10:55:00',
        9100101, 9101102, 9102003,
        'SOAP', 'p', 1, 'progressCourse', 'F', 0,
        '{"schemaVersion":1,"moduleType":"progressCourse","payloadJson":"{\"@class\":\"open.dolphin.infomodel.ProgressCourse\",\"freeText\":\"咳嗽改善乏しい\\n肺炎除外\\n画像確認後に抗菌薬調整\"}","payloadHash":"de4572246b30a0d16a30c4701666a798c0a98d5028c2dd4a96141711086012bd"}'::jsonb
    ),
    (
        9103004,
        TIMESTAMP '2026-03-10 11:15:00', TIMESTAMP '2026-03-10 11:15:00', TIMESTAMP '2026-03-10 11:30:00', TIMESTAMP '2026-03-10 11:30:00',
        9100101, 9101103, 9102004,
        'SOAP', 'p', 1, 'progressCourse', 'F', 0,
        '{"schemaVersion":1,"moduleType":"progressCourse","payloadJson":"{\"@class\":\"open.dolphin.infomodel.ProgressCourse\",\"freeText\":\"フォローアップ受診\\n添付画像確認\\nPDF説明書を添付\"}","payloadHash":"f987714338de9e9c764d8525be74e2f3d417f1650d5b43a1b99f0299526e58d3"}'::jsonb
    );

-- 2 image patterns for attachment validation.
INSERT INTO d_image (
    id, confirmed, started, ended, recorded,
    creator_id, karte_id, doc_id,
    contenttype, medicalrole, title, href, uri, digest,
    status, linkid, extension, bodypart
) VALUES
    (
        9104001,
        TIMESTAMP '2026-03-10 10:45:00', TIMESTAMP '2026-03-10 10:45:00', TIMESTAMP '2026-03-10 10:45:00', TIMESTAMP '2026-03-10 10:45:00',
        9100101, 9101102, 9102003,
        'image/png', 'img', '胸部レントゲン正面', 's3://p1-03-fixtures/images/chest-pa.png',
        's3://p1-03-fixtures/images/chest-pa.png', 'sha256:p103image1',
        'F', 0, '.png', 'chest'
    ),
    (
        9104002,
        TIMESTAMP '2026-03-10 10:46:00', TIMESTAMP '2026-03-10 10:46:00', TIMESTAMP '2026-03-10 10:46:00', TIMESTAMP '2026-03-10 10:46:00',
        9100101, 9101103, 9102004,
        'image/jpeg', 'img', '腹部エコー', 's3://p1-03-fixtures/images/abd-us.jpg',
        's3://p1-03-fixtures/images/abd-us.jpg', 'sha256:p103image2',
        'F', 0, '.jpg', 'abdomen'
    );

INSERT INTO d_attachment (
    id, confirmed, started, ended, recorded,
    creator_id, karte_id, doc_id,
    filename, contenttype, contentsize, lastmodified,
    digest, title, uri, extension, memo,
    status, linkid
) VALUES (
    9105001,
    TIMESTAMP '2026-03-10 10:47:00', TIMESTAMP '2026-03-10 10:47:00', TIMESTAMP '2026-03-10 10:47:00', TIMESTAMP '2026-03-10 10:47:00',
    9100101, 9101103, 9102004,
    'p103-discharge-summary.pdf', 'application/pdf', 24576, 1773139620000,
    'sha256:p103pdf1', '退院時サマリ', 's3://p1-03-fixtures/attachments/p103-discharge-summary.pdf', '.pdf',
    'P1-03 fixture document',
    'F', 0
);

-- Avoid sequence collisions after explicit IDs across every table using the shared Hibernate sequence.
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

COMMIT;
