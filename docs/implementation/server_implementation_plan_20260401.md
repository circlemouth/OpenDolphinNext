# サーバー実装計画書

作成日: 2026-04-01
対象: server 側のみ。web-client はこの計画では触らない。

## 1. この計画で固定する方針

- [ ] `POL-001` server 側だけを対象にする。`web-client/` 配下は変更しない。
- [ ] `POL-002` データベース本体は外部 PostgreSQL 前提で進める。アプリと同じサーバーに埋め込む前提へ戻さない。
- [ ] `POL-003` 画像・添付は外部オブジェクト保存前提で進める。設定値 `ATTACHMENT_STORAGE_MODE=s3` は維持し、意味は AWS 固定の S3 ではなく S3 互換 object storage とする。
- [ ] `POL-004` 本番用の local filesystem fallback は作らない。
- [ ] `POL-005` `database LOB` fallback は作らない。
- [ ] `POL-006` Firestore などの文書型データベースへの置換は行わない。
- [ ] `POL-007` 未実装 ORCA API `generic-price` / `hokenja` / `address` はこの計画で実装する。
- [ ] `POL-008` 後方互換性のためだけに旧設計を温存しない。
- [ ] `POL-009` build artifact、`target/`、生成物は確認対象から外し、ソースコードだけを直す。

## 2. この計画の到達点

この計画の完了条件は、次の 6 点です。

- [ ] `GOAL-001` `generic-price` / `hokenja` / `address` が 503 placeholder ではなく、実データを返す API になる。
- [ ] `GOAL-002` 添付と画像の外部保存が、同じ保存口と同じ失敗処理の流れで動く。
- [ ] `GOAL-003` 改訂カルテで、改訂した人が新しい文書の作成者として正しく残る。
- [ ] `GOAL-004` ORCA の生 SQL が resource / support に散っている部分を、専用の read service へ寄せる。
- [ ] `GOAL-005` 設定サンプルと運用文書で、外部 PostgreSQL + S3 互換 object storage の前提が明確になる。
- [ ] `GOAL-006` テストと static-analysis が通る。

## 3. 分岐ルール

迷いをなくすため、先に分岐ルールを固定します。

- [ ] `RULE-001` 作業 root に `pom.server-modernized.xml` があるなら build 入口は `mvn -f pom.server-modernized.xml -pl server-modernized -am` を使う。無いなら `mvn -f server-modernized/pom.xml` を使う。
- [ ] `RULE-002` 作業 tree に `AttachmentModel` / `SchemaModel` の実体定義と migration source があるなら、保存メタ情報列の追加まで同じ波で行う。無いなら、この波では `uri` + `digest` の契約を維持し、重複 entity を server module 内へ新設しない。
- [ ] `RULE-003` `generic-price` / `hokenja` / `address` の実テーブル名・列名は、current repo の証拠か、接続できる current ORCA schema から確定する。証拠が無いまま table 名を推測して実装しない。
- [ ] `RULE-004` ORCA schema 証拠が repo 内に無く、dev ORCA DB への read-only 接続も無い場合は、Phase 3 に入る前に運用担当から schema dump か table list を受け取る。これが無いまま DAO 実装へ進まない。
- [ ] `RULE-005` object storage の mode 名は `s3` のままにする。`minio` など新しい mode 値は追加しない。切り替えは endpoint / path-style / credentials で行う。
- [ ] `RULE-006` 画像保存だけ別実装のまま残さない。attachment と image の差が必要なら、共通口の上の薄い adapter に閉じ込める。
- [ ] `RULE-007` 新しい ORCA API 実装後、既存の 503 placeholder test は削除ではなく、成功・not found・validation test に置き換える。

## 4. 実装順序

実装順序は次で固定します。

1. Phase 0: 事前確認と作業土台
2. Phase 1: object storage 基盤の共通化
3. Phase 2: 改訂カルテの作成者記録修正
4. Phase 3: 未実装 ORCA API の実装
5. Phase 4: ORCA read path の整理
6. Phase 5: 設定・文書・運用前提の整理
7. Phase 6: 検証、最終確認、引き渡し

---

## Phase 0: 事前確認と作業土台

### 0-A. 作業 root とビルド入口を固定する

- [ ] `PRE-001` 担当: Codex  
  対象: repo root  
  実施: `pom.server-modernized.xml` の有無を確認し、今回使う build command を 1 本に固定する。  
  完了条件: `docs/implementation/server-build-root.md` を新規作成し、使う Maven command を 1 本だけ書く。

- [ ] `PRE-002` 担当: Codex  
  対象: repo root  
  実施: `domain/` と `persistence/` と migration source の有無を確認する。  
  完了条件: `docs/implementation/server-build-root.md` に、存在 / 不在を yes/no で追記する。

### 0-B. 対象コードを棚卸しする

- [ ] `PRE-003` 担当: Codex  
  対象: `server-modernized/src/main/java/open/orca/rest/OrcaMasterResource.java` ほか  
  実施: 未実装 endpoint、storage manager、revision service、ORCA 生 SQL の所在を列挙する。  
  完了条件: `docs/implementation/server-baseline-inventory.md` に次を記載する。  
  - 未実装 endpoint 3 本  
  - storage manager 2 本  
  - revision author 問題の所在  
  - ORCA 生 SQL の所在

- [ ] `PRE-004` 担当: Codex  
  対象: build/test  
  実施: 現状の targeted test 一覧を確定する。  
  完了条件: `docs/implementation/server-baseline-inventory.md` に、この計画で必ず触る test class を記載する。  
  必須対象:  
  - `open/orca/rest/OrcaMasterResourceTest`  
  - `open/orca/rest/OrcaMasterSchemaValidatorTest`  
  - `open/dolphin/storage/attachment/AttachmentStorageConfigLoaderTest`  
  - `open/dolphin/storage/attachment/AttachmentStorageManagerTest`  
  - `open/dolphin/mbean/ServletStartupSecurityGuardTest`  
  - `open/dolphin/session/KarteRevisionServiceBeanAttachmentCloneTest`  
  - `open/dolphin/runtime/config/StoragePersistenceContractValidatorTest`  
  - `open/dolphin/db/FreshSchemaBaselineTest`

### 0-C. ORCA schema 前提を確定する

- [ ] `PRE-005` 担当: 人手 / 運用  
  対象: ORCA master DB  
  実施: `generic-price` / `hokenja` / `address` に使う table と列の current schema 証拠を渡す。  
  完了条件: 次のどれかを用意する。  
  - read-only 接続情報  
  - schema dump  
  - `\d` 相当の table/column 一覧  
  - current ORCA schema 文書

- [ ] `PRE-006` 担当: Codex  
  対象: `open/orca/rest`  
  実施: `PRE-005` の証拠を `docs/implementation/orca-master-schema-evidence.md` に転記する。  
  完了条件: `generic-price` / `hokenja` / `address` それぞれについて table 名と列名が 1 つずつ確定している。

---

## Phase 1: object storage 基盤の共通化

### 1-A. 共通保存口を作る

- [ ] `STO-001` 担当: Codex  
  対象: `server-modernized/src/main/java/open/dolphin/storage/`  
  実施: 新しい package `open.dolphin.storage.objectstore` を作る。  
  完了条件: package が追加され、以下のクラスが新規作成されている。  
  - `ObjectStorageClient`  
  - `ObjectStorageLocation`  
  - `ObjectStoragePutRequest`  
  - `ObjectStoragePutResult`  
  - `ObjectStorageGetRequest`  
  - `ObjectStorageDeleteRequest`  
  - `ObjectStorageDigestSupport`

- [ ] `STO-002` 担当: Codex  
  対象: `open.dolphin.storage.objectstore`  
  実施: `S3CompatibleObjectStorageClient` を新規作成する。  
  完了条件: 既存の endpoint override / path style / SSE / KMS 設定を受け取って put/get/delete ができる。

- [ ] `STO-003` 担当: Codex  
  対象: `open/dolphin/storage/attachment/AttachmentStorageSettings.java` ほか  
  実施: 既存の `AttachmentStorageSettings.S3Settings` をそのまま使い、共通保存口に渡せる形に整える。  
  完了条件: 新しい mode や別形式の設定クラスを増やさず、既存設定だけで `S3CompatibleObjectStorageClient` を構築できる。

### 1-B. AttachmentStorageManager を共通保存口へ寄せる

- [ ] `STO-004` 担当: Codex  
  対象: `open/dolphin/storage/attachment/AttachmentStorageManager.java`  
  実施: S3 直呼びを `ObjectStorageClient` 経由へ置き換える。  
  完了条件: `S3Client` 直接操作が manager から消え、put/get/delete は共通保存口経由になる。

- [ ] `STO-005` 担当: Codex  
  対象: `AttachmentStorageManager.java`  
  実施: rollback hook / after-commit delete / digest 計算の責務を整理する。  
  完了条件: 失敗時削除と commit 後削除の分岐が、メソッド名だけで追える形になる。

### 1-C. ImageStorageManager を共通保存口へ寄せる

- [ ] `STO-006` 担当: Codex  
  対象: `open/dolphin/storage/image/ImageStorageManager.java`  
  実施: S3 直呼びを `ObjectStorageClient` 経由へ置き換える。  
  完了条件: `S3Client` 直接操作が manager から消える。

- [ ] `STO-007` 担当: Codex  
  対象: `ImageStorageManager.java`  
  実施: attachment 側と同等の rollback / after-commit delete 取り扱いを追加する。  
  完了条件: 画像削除だけ即時 delete、添付だけ after-commit という不一致が無くなる。どちらも transaction 境界を明示できる。

- [ ] `STO-008` 担当: Codex  
  対象: `open/dolphin/session/KarteDocumentWriteService.java`  
  実施: 画像削除と添付削除の扱いを共通規約にそろえる。  
  完了条件: `removeMissingSchemas` と `removeMissingAttachments` が、同じ transaction 方針で削除を行う。

### 1-D. storage test を揃える

- [ ] `STO-009` 担当: Codex  
  対象: `src/test/java/open/dolphin/storage/attachment/AttachmentStorageManagerTest.java`  
  実施: 共通保存口経由へ変えた後も既存ケースを維持するよう test を更新する。  
  完了条件: put/get/delete、digest、rollback hook の検証が残る。

- [ ] `STO-010` 担当: Codex  
  対象: `src/test/java/open/dolphin/storage/image/ImageStorageManagerTest.java`  
  実施: 新規 test class を作る。  
  完了条件: 最低でも次を検証する。  
  - 画像 upload 後に `uri` と `digest` が入る  
  - inline bytes が消える  
  - rollback / delete の扱い  
  - contentType ごとの suffix

- [ ] `STO-011` 担当: Codex  
  対象: `open/dolphin/runtime/config/StoragePersistenceContractValidatorTest.java`  
  実施: 現行契約 `uri` + `digest` が維持されることを再確認する。  
  完了条件: contract validator test が green。

### 1-E. entity source が存在する場合だけ行う拡張

- [ ] `STO-012` 担当: Codex  
  対象: `AttachmentModel` / `SchemaModel` 実体定義  
  実施: `RULE-002` に従い、entity source が存在するか確認する。  
  完了条件: `docs/implementation/storage-metadata-extension.md` に `APPLY` か `SKIP` を明記する。

- [ ] `STO-013` 担当: Codex  
  対象: entity source が存在する場合のみ  
  実施: 次の列を追加する。  
  - `storage_provider`  
  - `storage_bucket`  
  - `storage_key`  
  - `storage_version_id`  
  - `storage_etag`  
  完了条件: entity / migration / baseline test が揃って更新される。

- [ ] `STO-014` 担当: Codex  
  対象: entity source が存在しない場合のみ  
  実施: server module 内に重複 entity を作らず、この拡張を次 wave へ回す記録だけ残す。  
  完了条件: `docs/implementation/storage-metadata-extension.md` に `SKIP: entity source absent in current worktree` を書く。

---

## Phase 2: 改訂カルテの作成者記録修正

### 2-A. 改訂時の actor を resource で解決する

- [ ] `REV-001` 担当: Codex  
  対象: `server-modernized/src/main/java/open/dolphin/rest/KarteRevisionResource.java`  
  実施: 改訂 API 呼び出し時に、actual actor を `resolveActorId()` と `UserServiceBean` から解決する。  
  完了条件: `writeRevision()` から service に actor 情報を渡している。

- [ ] `REV-002` 担当: Codex  
  対象: `KarteRevisionResource.java`  
  実施: remote user が composite key の場合でも、実際の `UserModel` を引けるよう helper を整理する。  
  完了条件: actor 解決が 1 か所の helper にまとまる。

### 2-B. 改訂 clone の userModel を直す

- [ ] `REV-003` 担当: Codex  
  対象: `server-modernized/src/main/java/open/dolphin/session/KarteRevisionServiceBean.java`  
  実施: `createRevisionFromSource` の引数に actor を追加する。  
  完了条件: method signature が source/base/operation だけでなく actor を受ける。

- [ ] `REV-004` 担当: Codex  
  対象: `KarteRevisionServiceBean.java`  
  実施: `applyRevisionSnapshotMetadata()` で `cloned.setUserModel(source.getUserModel())` をやめ、actual actor を設定する。  
  完了条件: 新しい改訂文書の作成者が actual actor になる。

- [ ] `REV-005` 担当: Codex  
  対象: `KarteRevisionServiceBean.java`  
  実施: module / schema / attachment の `setUserModel()` も actual actor に合わせる。  
  完了条件: 子要素の userModel が source 由来のまま残らない。

- [ ] `REV-006` 担当: Codex  
  対象: revision audit  
  実施: 旧版との関係は `linkId` / `linkRelation` / audit detail に残し、作成者欄へ旧作成者を流し込まない。  
  完了条件: 「元文書を書いた人」と「今回改訂した人」が区別できる。

### 2-C. revision test を更新する

- [ ] `REV-007` 担当: Codex  
  対象: `src/test/java/open/dolphin/session/KarteRevisionServiceBeanAttachmentCloneTest.java`  
  実施: 新しい引数に合わせて test を更新する。  
  完了条件: actual actor が clone 後 document / attachment に入ることを検証する。

- [ ] `REV-008` 担当: Codex  
  対象: `src/test/java/open/dolphin/rest/KarteRevision*Test.java`  
  実施: resource 側の actor 解決と audit detail を検証する test を追加または更新する。  
  完了条件: revise / restore のどちらでも actual actor が監査記録に残る。

---

## Phase 3: 未実装 ORCA API の実装

### 3-A. 共通方針を固定する

- [ ] `API-001` 担当: Codex  
  対象: `docs/implementation/orca-master-api-contract.md`  
  実施: 3 endpoint の入出力方針を文書化する。  
  完了条件: 次を明記する。  
  - `generic-price`: exact code lookup、該当無しは 404  
  - `hokenja`: search endpoint、0 件は 200 + empty list  
  - `address`: zip lookup、該当無しは 404  
  - 503 は backend unavailable の時だけ  
  - cache / ETag / audit を既存 master API と同じ方針にそろえる

### 3-B. DAO type と gateway を拡張する

- [ ] `API-002` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterDaoTypes.java`  
  実施: 次の criteria / record base を追加する。  
  - `GenericPriceCriteriaBase`  
  - `HokenjaCriteriaBase`  
  - `AddressCriteriaBase`  
  - `GenericPriceRecordBase`  
  - `InsurerRecordBase`  
  - `AddressRecordBase`  
  完了条件: field 名が response mapper に渡せる粒度で揃う。

- [ ] `API-003` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterDao.java`  
  実施: public nested type と search method を追加する。  
  完了条件: 次の method が生える。  
  - `searchGenericPrice(...)`  
  - `searchHokenja(...)`  
  - `searchAddress(...)`

- [ ] `API-004` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterGateway.java` と `OrcaMasterDaoGateway.java`  
  実施: gateway interface と実装に 3 method を追加する。  
  完了条件: resource -> service -> gateway -> dao の道が切れずに通る。

- [ ] `API-005` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterService.java`  
  実施: service に 3 search method を追加する。  
  完了条件: resource が placeholder を通らず service を呼ぶ。

### 3-C. table contract を追加する

- [ ] `API-006` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterDaoTableMeta.java`  
  実施: `PRE-006` で確定した table/column 名を新しい meta class として追加する。  
  完了条件: 3 master それぞれに `SUPPORTED_CONTRACT` がある。

- [ ] `API-007` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterSchemaValidator.java`  
  実施: startup schema validator の supported table 一覧へ 3 master を追加する。  
  完了条件: validator が current supported contract を完全に検証する。

- [ ] `API-008` 担当: Codex  
  対象: `src/test/java/open/orca/rest/OrcaMasterSchemaValidatorTest.java`  
  実施: 3 master の positive / negative test を追加する。  
  完了条件: table 欠落と column 欠落の両方を拾える。

### 3-D. query service を追加する

- [ ] `API-009` 担当: Codex  
  対象: `open/orca/rest`  
  実施: 次の query service を新規作成する。  
  - `OrcaMasterGenericPriceQueryService.java`  
  - `OrcaMasterHokenjaQueryService.java`  
  - `OrcaMasterAddressQueryService.java`  
  完了条件: 新しい SQL を `OrcaMasterDao` にべた書きしない。

- [ ] `API-010` 担当: Codex  
  対象: `OrcaMasterDao.java`  
  実施: 3 query service を呼び出すだけの薄い method にする。  
  完了条件: DAO 本体は connection open と meta 受け渡しだけが中心になる。

### 3-E. response mapper と endpoint service を拡張する

- [ ] `API-011` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterResponseMapper.java`  
  実施: record -> response の mapping method を追加する。  
  完了条件: 次の overload がある。  
  - `toGenericPriceEntry(OrcaMasterDao.GenericPriceRecord, ...)`  
  - `toInsurerEntry(OrcaMasterDao.InsurerRecord, ...)`  
  - `toAddressEntry(OrcaMasterDao.AddressRecord, ...)`

- [ ] `API-012` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterCatalogEndpointService.java`  
  実施: 新しい response builder を追加する。  
  完了条件: 次の method がある。  
  - `buildGenericPriceResponse(...)`  
  - `buildHokenjaResponse(...)`  
  - `buildAddressResponse(...)`

- [ ] `API-013` 担当: Codex  
  対象: `OrcaMasterCatalogEndpointService.java`  
  実施: generic-price / hokenja / address でも、ETag / Cache-Control / audit 記録を既存 endpoint と同じ規約で付与する。  
  完了条件: 304 / 200 / 404 / 503 の挙動が既存 master API と整合する。

### 3-F. resource placeholder を置き換える

- [ ] `API-014` 担当: Codex  
  対象: `open/orca/rest/OrcaMasterResource.java`  
  実施: `getGenericPrice()` の 503 placeholder を remove し、criteria 作成 -> service 呼び出し -> response builder の流れへ置き換える。  
  完了条件: 503 placeholder code `MASTER_GENERIC_PRICE_UNAVAILABLE` を直接返す分岐が消える。

- [ ] `API-015` 担当: Codex  
  対象: `OrcaMasterResource.java`  
  実施: `getHokenja()` の 503 placeholder を置き換える。  
  完了条件: `pref` validation の後に実検索が走る。

- [ ] `API-016` 担当: Codex  
  対象: `OrcaMasterResource.java`  
  実施: `getAddress()` の 503 placeholder を置き換える。  
  完了条件: `zip` validation の後に実検索が走る。

### 3-G. endpoint test を置き換える

- [ ] `API-017` 担当: Codex  
  対象: `src/test/java/open/orca/rest/OrcaMasterResourceTest.java`  
  実施: `generic-price` の 503 placeholder test を success / 404 / validation / 304 test に置き換える。  
  完了条件: `MASTER_GENERIC_PRICE_UNAVAILABLE` 前提の test が残らない。

- [ ] `API-018` 担当: Codex  
  対象: `OrcaMasterResourceTest.java`  
  実施: `hokenja` の 503 placeholder test を success / empty result / validation / 304 test に置き換える。  
  完了条件: `MASTER_HOKENJA_UNAVAILABLE` 前提の test が残らない。

- [ ] `API-019` 担当: Codex  
  対象: `OrcaMasterResourceTest.java`  
  実施: `address` の 503 placeholder test を success / 404 / validation / 304 test に置き換える。  
  完了条件: `MASTER_ADDRESS_UNAVAILABLE` 前提の test が残らない。

### 3-H. 実用面の優先順位を反映する

- [ ] `API-020` 担当: Codex  
  対象: endpoint 実装順  
  実施: 実装順は `hokenja` → `address` → `generic-price` にする。  
  完了条件: commit history か implementation report で順序が分かる。

- [ ] `API-021` 担当: Codex  
  対象: `docs/implementation/orca-master-api-contract.md`  
  実施: 各 API の実用用途を一文で書く。  
  完了条件: 次が明記される。  
  - `hokenja`: 保険者入力補助  
  - `address`: 郵便番号から住所候補補助  
  - `generic-price`: 薬価の補助表示

---

## Phase 4: ORCA read path の整理

### 4-A. disease / order input / interaction の SQL を resource/support から外へ出す

- [ ] `ORR-001` 担当: Codex  
  対象: `server-modernized/src/main/java/open/dolphin/orca/read/`  
  実施: 新しい package `open.dolphin.orca.read` を作る。  
  完了条件: package が追加される。

- [ ] `ORR-002` 担当: Codex  
  対象: `open/dolphin/rest/orca/OrcaLiveDiseaseMasterResource.java`  
  実施: `tbl_byomei` 直 SQL を `OrcaDiseaseMasterReadService` へ移す。  
  完了条件: resource は request parse と response build だけになる。

- [ ] `ORR-003` 担当: Codex  
  対象: `open/dolphin/rest/orca/OrcaOrderInputSetSupport.java`  
  実施: `tbl_inputcd` / `tbl_inputset` / `tbl_tensu` の SQL を `OrcaOrderInputSetReadService` へ移す。  
  完了条件: support class に raw SQL string が残らない。

- [ ] `ORR-004` 担当: Codex  
  対象: `open/dolphin/rest/orca/OrcaOrderInteractionSupport.java`  
  実施: `tbl_interact` / `tbl_sskijyo` の SQL を `OrcaOrderInteractionReadService` へ移す。  
  完了条件: support class に raw SQL string が残らない。

### 4-B. read path test を足す

- [ ] `ORR-005` 担当: Codex  
  対象: `src/test/java/open/dolphin/rest/orca/OrcaOrderInputSetSupportTest.java`  
  実施: 抽出後も既存ケースが green になるよう更新する。  
  完了条件: support test が green。

- [ ] `ORR-006` 担当: Codex  
  対象: `src/test/java/open/dolphin/rest/orca/OrcaLiveDiseaseMasterReadServiceTest.java`  
  実施: 新規 test を作る。  
  完了条件: exact match / like match / no result を検証する。

- [ ] `ORR-007` 担当: Codex  
  対象: `src/test/java/open/dolphin/rest/orca/OrcaOrderInteractionReadServiceTest.java`  
  実施: 新規 test を作る。  
  完了条件: 相互作用 candidate の取得と空結果を検証する。

---

## Phase 5: 設定・文書・運用前提の整理

### 5-A. 設定コメントを truth に合わせる

- [ ] `CFG-001` 担当: Codex  
  対象: `config/attachment-storage.sample.yaml`  
  実施: コメントを AWS 固定の S3 ではなく S3 互換 object storage 前提へ修正する。  
  完了条件: `endpoint: http://minio:9000` の意味が sample コメントで説明される。

- [ ] `CFG-002` 担当: Codex  
  対象: `config/server-modernized.env.sample`  
  実施: `ATTACHMENT_STORAGE_MODE=s3` が S3 互換 object storage を指すこと、local filesystem fallback を作らないことを明記する。  
  完了条件: コメントだけで方針が分かる。

- [ ] `CFG-003` 担当: Codex  
  対象: `config/server-modernized.env.sample`  
  実施: DB は外部 PostgreSQL 前提であることを、既存コメントに沿ってより明確にする。  
  完了条件: 同居 DB を前提と読む余地が sample comment に残らない。

### 5-B. 実装メモを残す

- [ ] `CFG-004` 担当: Codex  
  対象: `server-modernized/docs/object-storage-contract.md`  
  実施: 次を記載する。  
  - DB に入るのは構造化データと object reference であること  
  - object storage は S3 互換であること  
  - MinIO を院内向け候補として使えること  
  - local filesystem fallback を作らないこと

- [ ] `CFG-005` 担当: Codex  
  対象: `server-modernized/docs/orca-master-supported-endpoints.md`  
  実施: 今回実装した 3 endpoint の query parameter / response shape / not found 方針を記載する。  
  完了条件: 担当者が resource を開かなくても contract を読める。

### 5-C. repo-external の運用前提を固定する

- [ ] `OPS-001` 担当: 人手 / 運用  
  対象: DB  
  実施: 外部 PostgreSQL の接続先、CA、認証情報を準備する。  
  完了条件: `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_SSLROOTCERT` が揃う。

- [ ] `OPS-002` 担当: 人手 / 運用  
  対象: object storage  
  実施: AWS S3 または別サーバー上の MinIO を準備する。  
  完了条件: bucket、region、endpoint、access key、secret key、SSE 方針が揃う。

- [ ] `OPS-003` 担当: 人手 / 運用  
  対象: ORCA  
  実施: ORCA DB read-only 接続と ORCA credential AES key を準備する。  
  完了条件: ORCA master query と ORCA API transport の両方が secrets で供給できる。

- [ ] `OPS-004` 担当: 人手 / 運用  
  対象: security  
  実施: `FACTOR2_AES_KEY_B64` と `DOCUMENT_INTEGRITY_KEYRING_PATH` を準備する。  
  完了条件: production-like startup guard を通せる。

---

## Phase 6: 検証、最終確認、引き渡し

### 6-A. targeted test を通す

- [ ] `VER-001` 担当: Codex  
  対象: build root  
  実施: ORCA master 関連 test を実行する。  
  完了条件: 次が通る。  
  - `OrcaMasterResourceTest`  
  - `OrcaMasterSchemaValidatorTest`

- [ ] `VER-002` 担当: Codex  
  対象: build root  
  実施: storage / revision 関連 test を実行する。  
  完了条件: 次が通る。  
  - `AttachmentStorageConfigLoaderTest`  
  - `AttachmentStorageManagerTest`  
  - `ImageStorageManagerTest`  
  - `StoragePersistenceContractValidatorTest`  
  - `KarteRevisionServiceBeanAttachmentCloneTest`

- [ ] `VER-003` 担当: Codex  
  対象: build root  
  実施: startup / baseline / ORCA read path test を実行する。  
  完了条件: 次が通る。  
  - `ServletStartupSecurityGuardTest`  
  - `FreshSchemaBaselineTest`  
  - `OrcaOrderInputSetSupportTest`  
  - 追加した ORCA read service test

### 6-B. static-analysis と compile を通す

- [ ] `VER-004` 担当: Codex  
  対象: build root  
  実施: compile を実行する。  
  完了条件: compile が通る。

- [ ] `VER-005` 担当: Codex  
  対象: build root  
  実施: `-Pstatic-analysis verify` を実行する。  
  完了条件: static-analysis が通る。

### 6-C. 実装報告を作る

- [ ] `VER-006` 担当: Codex  
  対象: `docs/implementation/server-implementation-report.md`  
  実施: 実装報告を作る。  
  完了条件: 次の 5 項目が必ず入る。  
  - 変更ファイル一覧  
  - 実行コマンド一覧  
  - 追加 / 更新 test 一覧  
  - `SKIP` した項目と理由  
  - 残る repo-external task

- [ ] `VER-007` 担当: Codex  
  対象: 実装報告  
  実施: placeholder / TODO / guessed table name が残っていないか確認する。  
  完了条件: 実装報告の最後に `No placeholder stubs remain.` と書ける状態にする。

---

## 5. 実行コマンドの固定形

作業担当は、以下の順で command を使うこと。

### 5-1. build root が `pom.server-modernized.xml` の場合

- [ ] `CMD-001` compile  
  `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile`

- [ ] `CMD-002` ORCA master 関連 test  
  `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=open.orca.rest.OrcaMasterResourceTest,open.orca.rest.OrcaMasterSchemaValidatorTest -Dsurefire.failIfNoSpecifiedTests=false test`

- [ ] `CMD-003` storage / revision / startup 関連 test  
  `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=open.dolphin.storage.attachment.AttachmentStorageConfigLoaderTest,open.dolphin.storage.attachment.AttachmentStorageManagerTest,open.dolphin.storage.image.ImageStorageManagerTest,open.dolphin.runtime.config.StoragePersistenceContractValidatorTest,open.dolphin.session.KarteRevisionServiceBeanAttachmentCloneTest,open.dolphin.mbean.ServletStartupSecurityGuardTest,open.dolphin.db.FreshSchemaBaselineTest -Dsurefire.failIfNoSpecifiedTests=false test`

- [ ] `CMD-004` ORCA read path 関連 test  
  `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=open.dolphin.rest.orca.OrcaOrderInputSetSupportTest,open.dolphin.rest.orca.OrcaLiveDiseaseMasterReadServiceTest,open.dolphin.rest.orca.OrcaOrderInteractionReadServiceTest -Dsurefire.failIfNoSpecifiedTests=false test`

- [ ] `CMD-005` static-analysis  
  `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`

### 5-2. build root が `server-modernized/pom.xml` の場合

- [ ] `CMD-006` 上記と同じ test 群を `mvn -f server-modernized/pom.xml ...` に置き換えて実行する。

---

## 6. この計画でやらないこと

- [ ] `NO-001` web-client の修正
- [ ] `NO-002` 同居 local filesystem を本番保存先として追加すること
- [ ] `NO-003` `database LOB` を復活させること
- [ ] `NO-004` Firestore など別系統 DB への置換
- [ ] `NO-005` 503 placeholder を残したまま UI だけ先に作ること
- [ ] `NO-006` ORCA の table 名を推測で決めること
- [ ] `NO-007` 旧作成者を新改訂文書の userModel に流し込むこと

## 7. 完了判定

次をすべて満たしたら、この計画は完了です。

- [ ] `DONE-001` 3 つの未実装 ORCA API が実データを返す。
- [ ] `DONE-002` attachment / image の保存口が共通化された。
- [ ] `DONE-003` revision 作成者が actual actor になった。
- [ ] `DONE-004` ORCA 生 SQL の主要な散在箇所が専用 read service へ移った。
- [ ] `DONE-005` 外部 PostgreSQL + S3 互換 object storage の前提が config と docs に明記された。
- [ ] `DONE-006` compile / targeted tests / static-analysis が green である。
