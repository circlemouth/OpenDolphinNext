# server-modernized 改修マスターチェックリスト

## 文書の目的
この文書は、`server-modernized` の明らかなムダと欠点を、本番運用前提・非互換許容の方針で整理し直すための実行計画である。単なる指摘メモではなく、担当者がそのまま着手できる粒度まで落とした開発仕様・作業順序・受け入れ条件・文書同期ルールを一体化している。

## 前提
- 後方互換は保持しない。
- 過去の DB 遺産は前提にしない。
- 本番運用を前提とし、fail-fast / fail-closed / least privilege / minimal disclosure を優先する。
- code first / doc first のどちらにも寄せず、**契約文書・コード・サンプル設定・テストの 4 点一致**を正とする。

## 完了条件（全体）
- [x] `docs/` 配下の契約文書が整備されている。
- [x] `README.md` からすべての契約文書へ到達できる。
- [x] `ServerConfigurationResolver` が唯一の runtime config 取得境界である。
- [x] health 系 API から内部接続情報が露出しない。
- [x] ORCA 接続設定が fail-closed で施設解決される。
- [x] ORCA 資格情報と 2FA secret の保護鍵が分離される。
- [x] document integrity が key rotation 可能である。
- [x] attachment storage が暗黙 fallback せず、patient images が context-root 非依存・低メモリになる。
- [x] runtime DDL が撤去され、Flyway が唯一のスキーマ変更経路になる。
- [x] build が sibling source へ依存しない。
- [x] Failsafe の統合テストが実行される。

## 残件クローズ追補（2026-03-22）
- [x] RC-01 Runtime Config strict closure: `ServerConfigurationResolver` だけを direct runtime lookup 許可対象に縮小し、raw property / env fallback と `dolphin.facilityId` を production tree から除去した。
- [x] RC-02 Generated Artifact Guard Hardening: `check-no-generated-artifacts.sh` を tracked / untracked 両検査へ強化し、commit 済み generated artifact を fail させる IT を追加した。tracked WAR も repo から除去した。
- [x] RC-03 Final Closure Audit / Handoff / Clean Archive: `mvn -f pom.server-modernized.xml -pl server-modernized -am clean verify`、manual grep、guard scripts、`git archive` + `zipinfo` 検査を実測し、clean archive 手順を runbook に固定した。
- [x] SpotBugs `Unsupported class file major version 69` は今回の closure 対象外として deferred を継続し、execution log / development status へ明記する。

## 作業の大原則

### 1. 1 変更 1 契約
- [x] 仕様を変える PR は、対応する `docs/contracts/*.md` を同時に更新する。
- [x] 設定を変える PR は、`config/server-modernized.env.sample` を同時に更新する。
- [x] 運用手順を変える PR は、`docs/runbooks/release-validation.md` を同時に更新する。

### 2. 互換レイヤーを増やさない
- [x] 旧 property / 旧 env / legacy header / TODO parameter は削除する。
- [x] 「今は旧挙動も受ける」は原則禁止とする。
- [x] 移行のための temporary fallback を入れる場合は、PR 中に削除予定日と削除タスクを明記し、この文書に checkbox を追加する。

### 3. fail-fast / fail-closed
- [x] 起動時に設定不備を検知できるものは runtime ではなく startup validation へ寄せる。
- [x] facility 未解決・storage 未設定・keyring 不正は即時失敗にする。

### 4. 情報最小公開
- [x] health / readiness / error response / audit log で接続先詳細と secret を露出しない。
- [x] fixed reasonCode を用い、raw exception message を返さない。

## 実施順序
1. 文書同期基盤と CI ガード
2. runtime config 契約一本化
3. health / observability / anonymous surface 修正
4. ORCA connection と secret protector 分離
5. document integrity keyring 化
6. attachment storage / patient images 修正
7. API 契約のウソ除去（ORCA master `scope`）
8. schema / build / test hygiene
9. 大型クラス分割

---

## WS-00 文書同期基盤と CI ガード

### 目的
コードと文書の乖離を構造的に防ぐ。今後の改修を「人の注意力」に依存させない。

### 成果物
- [x] `docs/README.md`
- [x] `docs/development/server-modernized-remediation-master-checklist.md`
- [x] `docs/development/pull-request-checklist-template.md`
- [x] `docs/contracts/*.md`
- [x] `docs/runbooks/release-validation.md`
- [x] `server-modernized/tools/ci/*.sh`

### 作業
- [x] `docs/` ディレクトリを正本として索引化した。
- [x] root `README.md` に `docs/` へのリンクを追加した。
- [x] 既存の broken link を、この文書群へ置き換えた。
- [x] PR テンプレート文書を作成した。
- [x] `server-modernized/tools/ci/check-doc-links.sh` を追加し、Markdown 内リンクと相対パスの存在を検証する。
- [x] `server-modernized/tools/ci/check-config-contract.sh` を追加し、`ServerConfigurationResolver` のキーと sample env の集合を比較する。
- [x] `server-modernized/tools/ci/check-no-direct-runtime-lookup.sh` を追加し、許可クラス以外の `System.getenv` / `System.getProperty` / `ConfigProvider.getConfig()` を禁止する。
- [x] `server-modernized/tools/ci/check-no-runtime-ddl.sh` を追加し、`src/main/java` 内の `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` 等を検出したら失敗させる。
- [x] `server-modernized/tools/ci/check-persistence-entities.sh` を追加し、`@Entity` と `persistence.xml` の対応漏れを検出する。
- [x] `server-modernized/tools/ci/check-no-generated-artifacts.sh` を追加し、`target/` や WAR がレビュー対象へ含まれていないことを検証する。
- [x] `pom.xml` の `verify` フェーズで上記チェックを実行する。

### 受け入れ条件
- [x] `mvn clean verify` で文書/設定/静的ガードが実行される。
- [x] broken link が 0 件。
- [x] PR テンプレートが使える。

---

## WS-01 Runtime Config 契約一本化

### 目的
設定契約を `ServerConfigurationResolver` に一本化し、直読み・旧キー fallback・ドメインごとの独自解決を廃止する。

### 対象ファイル
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- `src/main/java/open/dolphin/runtime/RuntimeConfigurationSupport.java`
- `src/main/java/open/dolphin/security/integrity/DocumentIntegrityConfig.java`
- `src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java`
- `src/main/java/open/dolphin/rest/PatientImagesResource.java`
- `src/main/java/open/dolphin/mbean/PvtService.java`
- `config/server-modernized.env.sample`
- `docs/contracts/runtime-config.md`

### 仕様
- `ServerConfigurationResolver` を唯一の I/O 境界とする。
- `RuntimeConfigurationSupport` は pure utility のみ残し、I/O を禁止する。
- attachment storage / patient images / document integrity / ORCA API / ORCA secret protector の typed settings を resolver に統合する。
- sample env は resolver の全キーを漏れなく掲載する。
- 旧 `dolphin.facilityId` fallback は削除する。
- `JBOSS_SERVER_DATA_DIR` を sample env と validator の契約に含める。

### 現時点の不足（修正対象）
- [x] `OPENDOLPHIN_FACILITY_ID` が sample env にない。
- [x] `OPENDOLPHIN_PVT_*` 一式が sample env にない。
- [x] `JBOSS_SERVER_DATA_DIR` が sample env のキー一覧として扱われていない。
- [x] `DocumentIntegrityConfig` が独自に env/property を解決している。
- [x] `AttachmentStorageConfigLoader` が独自に Config を読み、暗黙 database fallback している。
- [x] `PatientImagesResource` が static helper 経由で property/env を直接解決している。

### 実装手順
1. [x] `ServerRuntimeConfiguration` に次の nested settings を追加する。
   - [x] `OrcaApiSettings`
   - [x] `AttachmentStorageSettings`
   - [x] `PatientImagesSettings`
   - [x] `DocumentIntegritySettings`
   - [x] `OrcaSecretProtectionSettings`
2. [x] `ServerConfigurationResolver` へ上記 settings の解決関数を追加する。
3. [x] `ServerConfigurationResolver.optional()` は MicroProfile Config のみを読む。`System.getProperty` / `System.getenv` の直接 fallback を削除する。
4. [x] `RuntimeConfigurationSupport` の設定解決 API を削除または deprecate ではなく置換削除する。
5. [x] `DocumentIntegrityConfig` を resolver 依存へ置き換える。
6. [x] `AttachmentStorageConfigLoader` を resolver 依存へ置き換える、またはクラス自体を削除して typed config 実装へ移行する。
7. [x] `PatientImagesResource` / `PvtService` などの call site へ resolver を注入する。
8. [x] `ServerConfigurationValidator` に新ドメイン validation を追加する。
9. [x] `config/server-modernized.env.sample` を全面更新する。
10. [x] `docs/contracts/runtime-config.md` を実装どおりに更新する。

### validation 追加要件
- [x] runtime: environment / timezone / server data dir
- [x] ORCA runtime: facility-id / cloud-zero / PVT 詳細
- [x] datasource: host / port / name / user / password / sslmode / sslrootcert
- [x] ORCA API: base-url または host+port+scheme、mode、credential
- [x] attachment storage: mode ごとの必須項目
- [x] patient images: enabled 時の max-bytes / max-width / max-height
- [x] document integrity: mode ごとの HMAC key / key-id
- [x] second factor / FIDO2 / ORCA secret protector

### 受け入れ条件
- [x] 設定取得の direct call が許可クラス以外に残っていない。
- [x] sample env と resolver の差分が 0。
- [x] validator の異常系テストが通る。

---

## WS-02 Health / Observability / Anonymous Surface 修正

### 目的
匿名公開面から内部構成を隠し、運用者向けの診断は認証付き・sanitize 済みの情報だけ返す。

### 対象ファイル
- `src/main/java/open/dolphin/rest/LogFilter.java`
- `src/main/java/open/dolphin/rest/OperationsHealthResource.java`
- `src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`
- `src/main/java/open/dolphin/orca/transport/OrcaTransportSettings.java`
- `src/main/java/open/dolphin/mbean/PvtService.java`
- `docs/contracts/health-endpoints.md`

### 現時点の問題
- [x] `/api/health/readiness` が匿名許可されている。
- [x] readiness に ORCA URL / statusCode / storage mode / patient image max 値 / raw message が含まれている。
- [x] ORCA audit summary が host / port / scheme / baseUrl を含む。

### 実装手順
1. [x] `GET /api/health` を匿名 liveness 専用に固定する。
2. [x] `GET /api/health/readiness` を匿名 minimal readiness とし、`{"status": "UP|DOWN"}` だけ返す。
3. [x] `GET /api/operations/readiness` を追加し、認証必須の sanitized details を返す。
4. [x] `LogFilter.isAnonymousAllowed()` を上記契約に合わせて修正する。
5. [x] `OperationsHealthResource` を minimal readiness と operations readiness に分割する。
6. [x] ORCA probe 結果は `reasonCode` と抽象化済み状態のみ返す。
7. [x] attachment storage probe を追加し、backend 実疎通を判定する。
8. [x] patient images readiness から max bytes / max width / max height を外す。
9. [x] raw exception message を fixed reasonCode へ置き換える。

### 追加修正（PVT）
- [x] `PvtService.register()` の `Logger.getLogger("open.dolphin").getLevel().equals(...)` を NPE 安全な実装へ修正する。
- [x] `DEBUG` 判定は `Level.FINE.equals(logger.getLevel())` または `logger.isLoggable(Level.FINE)` へ置換する。

### 受け入れ条件
- [x] 匿名 endpoint から URL / host / port / statusCode / raw message が返らない。
- [x] operations readiness でも secret と接続先詳細が返らない。
- [x] PVT 起動時に logger level 未設定でも NPE にならない。

---

## WS-03 ORCA Connection / Secret Protector 分離

### 目的
施設別設定を安全に解決し、2FA と ORCA 資格情報の暗号鍵を分離する。

### 対象ファイル
- `src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java`
- `src/main/java/open/dolphin/security/SecondFactorSecurityConfig.java`
- `src/main/java/open/dolphin/orca/transport/OrcaTransportSettings.java`
- `src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`
- `docs/contracts/orca-connection.md`

### 現時点の問題
- [x] `_default` が最後に保存した施設で上書きされる。
- [x] facility 未解決時に `_default` や先頭 record に fallback する。
- [x] ORCA credential の暗号化に TOTP protector が使われている。
- [x] audit summary に接続先詳細が含まれる。

### 実装手順
1. [x] ORCA 専用 protector 設定クラスを追加する。
2. [x] `OrcaConnectionConfigStore.requireProtector()` を ORCA 専用 protector へ差し替える。
3. [x] default facility を明示設定フィールドとして保存し、record 更新と分離する。
4. [x] `selectRecordForFacilityLocked()` から暗黙 fallback を削除する。
5. [x] `refreshCurrentFromRecordsLocked()` の「先頭 record を default 化」ロジックを削除する。
6. [x] facility 未解決時は `IllegalStateException` ではなく、上位で扱える固定 reasonCode へ変換する。
7. [x] `auditSummary()` を sanitize する。
8. [x] lookup / save / default facility update / reload のテストを更新する。

### 受け入れ条件
- [x] facility 未解決で別施設へ接続しない。
- [x] ORCA 鍵と 2FA 鍵が分離される。
- [x] readiness / audit / logs に接続先詳細が出ない。

---

## WS-04 Document Integrity Keyring 化

### 目的
鍵ローテーションに耐える真正性検証へ再設計する。

### 対象ファイル
- `src/main/java/open/dolphin/security/integrity/DocumentIntegrityConfig.java`
- `src/main/java/open/dolphin/security/integrity/DocumentIntegrityService.java`
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- `docs/contracts/document-integrity.md`

### 現時点の問題
- [x] 現在設定中 keyId と保存済み keyId の一致を要求している。
- [x] 検証に現在鍵しか使えない。
- [x] 起動時 validation が document integrity を検査していない。

### 実装手順
1. [x] `document.integrity.keyring-path` を導入する。
2. [x] keyring loader を追加し、active / verify-only を扱う。
3. [x] `DocumentIntegrityConfig.Settings` を単一鍵から keyring 参照へ変更する。
4. [x] `sealDocument()` は active key を使用する。
5. [x] `verifyDocumentOnRead()` は保存済み `keyId` に対応する key を使用する。
6. [x] active key との一致判定を削除する。
7. [x] `mode=enforce` と `mode=permissive` の分岐を fixed reasonCode ベースで整理する。
8. [x] validator に keyring validation を追加する。
9. [x] key rotation の runbook を文書化する。

### 受け入れ条件
- [x] active key を差し替えても旧文書が verify できる。
- [x] `mode=enforce` は 409 を返し、`mode=permissive` は読み取りを継続する。
- [x] malformed keyring / active key 複数 / keyId 重複で起動失敗する。

---

## WS-05 Attachment Storage / Patient Images 修正

### 目的
暗黙 fallback を廃止し、patient images を context-root 非依存・低メモリ・安全な実装へ改める。

### 対象ファイル
- `src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java`
- `src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`
- `src/main/java/open/dolphin/rest/PatientImagesResource.java`
- `src/main/java/open/dolphin/rest/OperationsHealthResource.java`
- `docs/contracts/patient-images.md`

### 現時点の問題
- [x] attachment-storage.yaml 不在時に warning だけで database mode に fallback する。
- [x] storage readiness が backend 実疎通を見ていない。
- [x] `downloadUrl` が `/openDolphin` 固定。
- [x] upload で全 byte 読み込み -> 全 decode -> 再 encode をしている。
- [x] 寸法チェックが decode 後で、圧縮爆弾耐性が弱い。

### 実装手順
1. [x] attachment storage 設定を typed config に統合し、暗黙 fallback を削除する。
2. [x] storage mode を必須指定にする。
3. [x] `AttachmentStorageManager` に backend probe を追加する。
4. [x] readiness で backend probe を使う。
5. [x] `PatientImagesResource.list()` は `UriInfo` を使って `downloadUrl` を構築する。
6. [x] upload を temp file + streaming 構成へ置き換える。
7. [x] magic number と declared Content-Type の一致を検証する。
8. [x] `ImageReader` で寸法取得後に decode する。
9. [x] JPEG alpha の flatten は白背景で行う。
10. [x] 再 encode 後サイズも上限内であることを確認する。
11. [x] temp file を確実に削除する。

### 受け入れ条件
- [x] storage 設定不足で起動失敗する。
- [x] readiness が backend 実疎通を反映する。
- [x] `downloadUrl` が context-root 非依存になる。
- [x] upload が全 byte を常駐させない。

---

## WS-06 ORCA Master API のウソ除去

### 目的
実装されていない query parameter を排除する。

### 対象ファイル
- `src/main/java/open/orca/rest/OrcaMasterResource.java`
- `src/main/java/open/orca/rest/OrcaMasterDao.java`
- `src/test/java/open/orca/rest/OrcaMasterResourceTest.java`
- `docs/contracts/orca-master-api.md`

### 現時点の問題
- [x] `scope` を受け取るが、DAO 実装は TODO のままで効かない。

### 実装手順
- [x] `scope` を API 契約から削除する。
- [x] `scope` が来た場合は 400 `unsupported_parameter` を返す。
- [x] `appendDrugScopeFilter()` を削除する。
- [x] テストと文書を更新する。

### 受け入れ条件
- [x] `scope` が silent ignore されない。
- [x] コード・文書・テストから `scope` の曖昧な契約が消える。

---

## WS-07 Schema / Build / Test Hygiene

### 目的
ビルドとスキーマ責務を整理し、実行時 DDL・generated artifact・未実行 integration test を解消する。

### 対象ファイル
- `src/main/java/open/dolphin/orca/sync/OrcaPatientSyncStateStore.java`
- `tools/flyway/sql/V0301__orca_patient_sync_state_store.sql`
- `tools/flyway/README.md`
- `pom.xml`
- `src/main/resources/META-INF/persistence.xml`
- `docs/runbooks/release-validation.md`

### 現時点の問題
- [x] runtime DDL と Flyway が二重化していた。
- [x] build-helper plugin が `../api-contract/src/main/java` を source に追加していた。
- [x] `target/` が成果物に混ざらない検証を追加した。
- [x] Failsafe 実行実績を verify で維持した。
- [x] `persistence.xml` の entity list が手作業で drift しやすかった。

### 実装手順
1. [x] `OrcaPatientSyncStateStore` から `SQL_CREATE_TABLE` と `ensureSchema()` を削除する。
2. [x] `V0301__orca_patient_sync_state_store.sql` を唯一のテーブル作成元として維持する。
3. [x] integration test で Flyway 適用後のみ store が動くことを確認する。
4. [x] `pom.xml` から sibling source を追加する build-helper 設定を削除する。
5. [x] build は artifact dependency または reactor 構成で完結させる。
6. [x] `target/` / WAR / surefire report をソース成果物に含めない運用を定義する。
7. [x] Failsafe の統合テストを verify で 1 件以上実行する。
8. [x] `persistence.xml` と `@Entity` の整合性を検証するテストか CI スクリプトを追加する。

### 推奨統合テスト
- [x] startup validation failure cases
- [x] Flyway migrate + JPA boot
- [x] ORCA connection config resolution
- [x] document integrity key rotation
- [x] patient image upload/list/download
- [x] health endpoints auth/sanitization

### 受け入れ条件
- [x] runtime DDL が `src/main/java` から消える。
- [x] sibling source 依存なしで `mvn clean verify` できる。
- [x] Failsafe summary の `completed > 0`。
- [x] generated artifact を配布物に含めない。

---

## WS-08 大型クラス分割

### 目的
責務集中と可読性低下を解消し、以後の改修コストを下げる。

### 優先対象
- [x] `open/dolphin/rest/orca/OrcaOrderBundleResource.java`
- [x] `open/dolphin/session/KarteServiceBean.java`
- [x] `open/orca/rest/OrcaResource.java`
- [x] `open/orca/rest/OrcaMasterDao.java`
- [x] `open/orca/rest/OrcaMasterResource.java`
- [x] `open/orca/rest/EtensuDao.java`
- [x] `open/dolphin/rest/masterupdate/MasterUpdateService.java`
- [x] `open/dolphin/rest/PatientModV2OutpatientResource.java`

### 分割ルール
- [x] まず characterization test を追加する。
- [x] 次に parameter parsing / validation / service / mapper / repository へ分割する。
- [x] 挙動変更 PR と構造変更 PR を混ぜない。
- [x] 1 クラス 700 行以下、1 メソッド 80 行以下を目標にする。
- [x] static analysis へ class length / method length ルールを追加する。

### `OrcaMasterResource` 分割案
- [x] query param parser
- [x] authorization helper
- [x] ETag / cache helper
- [x] response assembler
- [x] fixture loader

### `OrcaMasterDao` 分割案
- [x] drug query service
- [x] comment query service
- [x] material query service
- [x] generic class query service
- [x] SQL helper / paging helper

### 受け入れ条件
- [x] 大型クラスの public contract がテストで固定される。
- [x] 分割後に static analysis が閾値内になる。

---

## 手動レビュー用チェック

### セキュリティ
- [x] health / readiness に内部接続情報がない。
- [x] audit / logs に secret がない。
- [x] ORCA facility 未解決時に fail-closed する。
- [x] document integrity が key rotation 可能。

### 運用
- [x] sample env だけで必要設定が把握できる。
- [x] release runbook が最新化されている。
- [x] broken link がない。

### 品質
- [x] unit test / integration test / static analysis / contract check が動く。
- [x] generated artifact がレビュー対象に混ざっていない。

---

## PR 分割ガイド
- [x] PR-1: WS-00 文書同期基盤
- [x] PR-2: WS-01 runtime config
- [x] PR-3: WS-02 health + PVT NPE
- [x] PR-4: WS-03 ORCA connection + secret protector
- [x] PR-5: WS-04 document integrity
- [x] PR-6: WS-05 attachment storage + patient images
- [x] PR-7: WS-06 ORCA master API cleanup
- [x] PR-8: WS-07 schema/build/test hygiene
- [x] PR-9 以降: WS-08 大型クラス分割

## 完了報告フォーマット
各 PR 完了時に、この文書の該当 WS に次を追記する。
- 実装 PR / commit 番号
- 変更ファイル一覧
- 追加テスト一覧
- 実行コマンド
- 残課題
