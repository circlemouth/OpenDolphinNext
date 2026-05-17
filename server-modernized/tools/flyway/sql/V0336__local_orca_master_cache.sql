CREATE TABLE IF NOT EXISTS opendolphin.local_orca_master_dataset (
    master_type VARCHAR(64) PRIMARY KEY,
    source_system VARCHAR(128) NOT NULL,
    source_kind VARCHAR(32) NOT NULL,
    source_api VARCHAR(256),
    source_file VARCHAR(256),
    master_version VARCHAR(64),
    effective_from VARCHAR(8) NOT NULL DEFAULT '00000000',
    effective_to VARCHAR(8) NOT NULL DEFAULT '99991231',
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stale BOOLEAN NOT NULL DEFAULT FALSE,
    unavailable_reason VARCHAR(128),
    cache_status VARCHAR(32) NOT NULL DEFAULT 'NOT_IMPORTED',
    read_only BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT local_orca_master_dataset_read_only_ck CHECK (read_only = TRUE),
    CONSTRAINT local_orca_master_dataset_source_kind_ck CHECK (
        source_kind IN ('official-file', 'official-api', 'manual-upload', 'fixture-dev', 'local-cache')
    ),
    CONSTRAINT local_orca_master_dataset_status_ck CHECK (
        cache_status IN ('CURRENT', 'STALE', 'NOT_IMPORTED', 'UNAVAILABLE')
    )
);

CREATE TABLE IF NOT EXISTS opendolphin.local_orca_master_entry (
    id BIGSERIAL PRIMARY KEY,
    master_type VARCHAR(64) NOT NULL REFERENCES opendolphin.local_orca_master_dataset(master_type),
    code VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    kana VARCHAR(255),
    category VARCHAR(64),
    unit VARCHAR(64),
    price NUMERIC(12, 2),
    valid_from VARCHAR(8) NOT NULL DEFAULT '00000000',
    valid_to VARCHAR(8) NOT NULL DEFAULT '99991231',
    master_version VARCHAR(64),
    note VARCHAR(255),
    search_text TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_only BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT local_orca_master_entry_read_only_ck CHECK (read_only = TRUE),
    CONSTRAINT local_orca_master_entry_uk UNIQUE (master_type, code, valid_from, valid_to)
);

CREATE INDEX IF NOT EXISTS idx_local_orca_master_entry_search
    ON opendolphin.local_orca_master_entry USING gin ((lower(search_text)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_local_orca_master_entry_type_name
    ON opendolphin.local_orca_master_entry(master_type, name, code);
CREATE INDEX IF NOT EXISTS idx_local_orca_master_entry_payload
    ON opendolphin.local_orca_master_entry USING gin (payload_json);

CREATE TABLE IF NOT EXISTS opendolphin.local_orca_master_inputset (
    set_code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    entity VARCHAR(64),
    kind VARCHAR(16),
    class_code VARCHAR(16),
    class_name VARCHAR(255),
    item_count INTEGER NOT NULL DEFAULT 0,
    valid_from VARCHAR(8) NOT NULL DEFAULT '00000000',
    valid_to VARCHAR(8) NOT NULL DEFAULT '99991231',
    master_version VARCHAR(64),
    search_text TEXT NOT NULL,
    read_only BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT local_orca_master_inputset_read_only_ck CHECK (read_only = TRUE)
);

CREATE TABLE IF NOT EXISTS opendolphin.local_orca_master_inputset_item (
    id BIGSERIAL PRIMARY KEY,
    set_code VARCHAR(32) NOT NULL REFERENCES opendolphin.local_orca_master_inputset(set_code),
    seq INTEGER NOT NULL,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity VARCHAR(32),
    unit VARCHAR(64),
    memo VARCHAR(255),
    row_role VARCHAR(32) NOT NULL DEFAULT 'main',
    row_subtype VARCHAR(64),
    category VARCHAR(64),
    valid_from VARCHAR(8) NOT NULL DEFAULT '00000000',
    valid_to VARCHAR(8) NOT NULL DEFAULT '99991231',
    read_only BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT local_orca_master_inputset_item_read_only_ck CHECK (read_only = TRUE),
    CONSTRAINT local_orca_master_inputset_item_uk UNIQUE (set_code, seq)
);

CREATE TABLE IF NOT EXISTS opendolphin.local_orca_master_interaction (
    id BIGSERIAL PRIMARY KEY,
    code1 VARCHAR(32) NOT NULL,
    code2 VARCHAR(32) NOT NULL,
    interaction_code VARCHAR(32),
    interaction_name VARCHAR(255),
    message VARCHAR(255),
    valid_from VARCHAR(8) NOT NULL DEFAULT '00000000',
    valid_to VARCHAR(8) NOT NULL DEFAULT '99991231',
    master_version VARCHAR(64),
    read_only BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT local_orca_master_interaction_read_only_ck CHECK (read_only = TRUE),
    CONSTRAINT local_orca_master_interaction_uk UNIQUE (code1, code2, interaction_code)
);

COMMENT ON TABLE opendolphin.local_orca_master_dataset IS
    'OpenDolphin local ORCA-equivalent master cache/projection metadata. Candidate search only; not ORCA source of truth.';
COMMENT ON TABLE opendolphin.local_orca_master_entry IS
    'OpenDolphin local master candidate cache/projection rows. Read-only API surface; import jobs refresh this table.';
COMMENT ON TABLE opendolphin.local_orca_master_inputset IS
    'OpenDolphin-managed order input set candidate cache/projection. Not an ORCA authoritative order or billing result.';
COMMENT ON TABLE opendolphin.local_orca_master_interaction IS
    'OpenDolphin local interaction candidate cache/projection. Unavailable cache must not be treated as safe.';

INSERT INTO opendolphin.local_orca_master_dataset (
    master_type, source_system, source_kind, source_file, master_version,
    effective_from, effective_to, imported_at, stale, unavailable_reason, cache_status, read_only
)
SELECT master_type, 'OpenDolphinLocalMasterCache', 'fixture-dev', 'server-modernized local fixture seed',
       'fixture-20260517', '20240401', '99991231', CURRENT_TIMESTAMP, FALSE, NULL, 'CURRENT', TRUE
FROM (VALUES
    ('generic-class'),
    ('generic-price'),
    ('drug'),
    ('hokenja'),
    ('address'),
    ('comment'),
    ('bodypart'),
    ('youhou'),
    ('material'),
    ('kensa-sort'),
    ('etensu'),
    ('order-inputsets'),
    ('order-interactions'),
    ('disease-candidate')
) AS seed(master_type)
ON CONFLICT (master_type) DO UPDATE SET
    source_system = EXCLUDED.source_system,
    source_kind = EXCLUDED.source_kind,
    source_file = EXCLUDED.source_file,
    master_version = EXCLUDED.master_version,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to,
    imported_at = EXCLUDED.imported_at,
    stale = EXCLUDED.stale,
    unavailable_reason = EXCLUDED.unavailable_reason,
    cache_status = EXCLUDED.cache_status,
    read_only = TRUE;

INSERT INTO opendolphin.local_orca_master_entry (
    master_type, code, name, kana, category, unit, price, valid_from, valid_to,
    master_version, note, search_text, payload_json, read_only
) VALUES
    ('drug', '620006949', 'ゲンタシン軟膏０．１％', 'ゲンタシンナンコウ', '264', '本', 11.20,
     '20240401', '99991231', 'fixture-20260517', 'local master candidate fixture',
     lower('620006949 ゲンタシン軟膏０．１％ ゲンタシンナンコウ ゲンタ'), '{}'::jsonb, TRUE),
    ('generic-price', '620006949', 'ゲンタシン軟膏０．１％', 'ゲンタシンナンコウ', '264', '本', 11.20,
     '20240401', '99991231', 'fixture-20260517', '9-digit exact lookup fixture',
     lower('620006949 ゲンタシン軟膏０．１％ ゲンタシンナンコウ'), '{}'::jsonb, TRUE),
    ('generic-class', '264', '鎮痛・鎮痒・収斂・消炎剤', 'チンツウチンヨウシュウレンショウエンザイ', '264', NULL, NULL,
     '20240401', '99991231', 'fixture-20260517', NULL,
     lower('264 鎮痛 鎮痒 収斂 消炎 外用薬'), '{}'::jsonb, TRUE),
    ('hokenja', '01130012', '全国健康保険協会 東京支部', 'ゼンコクケンコウホケンキョウカイトウキョウシブ', '協会けんぽ', NULL, NULL,
     '20240401', '99991231', 'fixture-20260517', NULL,
     lower('01130012 全国健康保険協会 東京支部 東京 13'), '{"prefCode":"13","cityCode":"13101","phone":"000-0000-0000"}'::jsonb, TRUE),
    ('address', '1000001', '東京都千代田区千代田', 'トウキョウトチヨダクチヨダ', '13', NULL, NULL,
     '20240401', '99991231', 'fixture-20260517', NULL,
     lower('1000001 東京都千代田区千代田 東京 千代田'), '{"zip":"1000001","prefCode":"13","cityCode":"13101","city":"千代田区","town":"千代田","addressLine":"東京都千代田区千代田","kanaAddress":"トウキョウトチヨダクチヨダ"}'::jsonb, TRUE),
    ('comment', '008500001', '別途コメント', 'ベットコメント', 'comment', NULL, NULL,
     '20240401', '99991231', 'fixture-20260517', NULL,
     lower('008500001 別途コメント コメント'), '{}'::jsonb, TRUE),
    ('bodypart', '002000001', '胸部', 'キョウブ', 'bodypart', NULL, NULL,
     '20240401', '99991231', 'fixture-20260517', NULL,
     lower('002000001 胸部 部位'), '{}'::jsonb, TRUE),
    ('youhou', '001000001', '１日１回朝食後', 'イチニチイッカイチョウショクゴ', 'usage', NULL, NULL,
     '20240401', '99991231', 'fixture-20260517', NULL,
     lower('001000001 １日１回朝食後 用法'), '{"timingCode":"morning","routeCode":"oral","dosePerDay":"1"}'::jsonb, TRUE),
    ('material', '700000031', 'カテーテル材料', 'カテーテルザイリョウ', 'material', '本', 120.00,
     '20240401', '99991231', 'fixture-20260517', NULL,
     lower('700000031 カテーテル 材料'), '{}'::jsonb, TRUE),
    ('kensa-sort', '160000010', '血液検査', 'ケツエキケンサ', 'kensa', NULL, NULL,
     '20240401', '99991231', 'fixture-20260517', NULL,
     lower('160000010 血液検査 検査'), '{"kensaSort":"blood"}'::jsonb, TRUE),
    ('etensu', '160000010', '血液採取', 'ケツエキサイシュ', '6', '回', 16.00,
     '20240401', '99991231', 'fixture-20260517', 'fixture etensu candidate',
     lower('160000010 血液採取 検査 6'), '{"noticeDate":"20240401"}'::jsonb, TRUE),
    ('disease-candidate', '8839001', '高血圧症', 'コウケツアツショウ', 'I10', NULL, NULL,
     '20240401', '99991231', 'fixture-20260517', 'local disease candidate fixture',
     lower('8839001 高血圧症 コウケツアツショウ'), '{"icdTen":"I10"}'::jsonb, TRUE)
ON CONFLICT (master_type, code, valid_from, valid_to) DO UPDATE SET
    name = EXCLUDED.name,
    kana = EXCLUDED.kana,
    category = EXCLUDED.category,
    unit = EXCLUDED.unit,
    price = EXCLUDED.price,
    master_version = EXCLUDED.master_version,
    note = EXCLUDED.note,
    search_text = EXCLUDED.search_text,
    payload_json = EXCLUDED.payload_json,
    read_only = TRUE;

INSERT INTO opendolphin.local_orca_master_inputset (
    set_code, name, entity, kind, class_code, class_name, item_count, valid_from, valid_to,
    master_version, search_text, read_only
) VALUES
    ('S60001', '細菌検査セット', 'bacteriaOrder', 'S', '600', '細菌検査', 3,
     '20240401', '99991231', 'fixture-20260517', lower('S60001 細菌検査セット bacteria'), TRUE)
ON CONFLICT (set_code) DO UPDATE SET
    name = EXCLUDED.name,
    entity = EXCLUDED.entity,
    kind = EXCLUDED.kind,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    item_count = EXCLUDED.item_count,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    master_version = EXCLUDED.master_version,
    search_text = EXCLUDED.search_text,
    read_only = TRUE;

INSERT INTO opendolphin.local_orca_master_inputset_item (
    set_code, seq, code, name, quantity, unit, memo, row_role, row_subtype, category,
    valid_from, valid_to, read_only
) VALUES
    ('S60001', 1, '160000010', '血液採取', '1', '回', '', 'main', NULL, '6', '20240401', '99991231', TRUE),
    ('S60001', 2, '700000031', 'カテーテル材料', '1', '本', '', 'material', NULL, 'material', '20240401', '99991231', TRUE),
    ('S60001', 3, '008500001', '別途コメント', NULL, NULL, '', 'comment', NULL, 'comment', '20240401', '99991231', TRUE)
ON CONFLICT (set_code, seq) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    memo = EXCLUDED.memo,
    row_role = EXCLUDED.row_role,
    row_subtype = EXCLUDED.row_subtype,
    category = EXCLUDED.category,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    read_only = TRUE;

INSERT INTO opendolphin.local_orca_master_interaction (
    code1, code2, interaction_code, interaction_name, message, valid_from, valid_to, master_version, read_only
) VALUES
    ('620006949', '620000002', 'LMI0001', '相互作用候補', '相互作用候補が検出されました', '20240401', '99991231', 'fixture-20260517', TRUE)
ON CONFLICT (code1, code2, interaction_code) DO UPDATE SET
    interaction_name = EXCLUDED.interaction_name,
    message = EXCLUDED.message,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    master_version = EXCLUDED.master_version,
    read_only = TRUE;
