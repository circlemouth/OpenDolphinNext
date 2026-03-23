# server-modernized 危険経路修正 実行チェックリスト
更新日: 2026-03-23  
目的: 危険経路修正統合方針を、担当者が追加判断なしで実装できる粒度まで分解する  
対象: `server-modernized` バックエンド stopgap patch  
位置付け: `server-modernized` の現行開発計画の正本  
前提:
- D1〜D11 は承認済み。再議論しない
- 後方互換性は考慮しない
- 過去の DB 遺産はない前提
- 本番運用前提
- legacy / fallback / shadow / compat は削除候補
- 今回は止血。大規模再設計は Phase2-A へ回す
- 旧 `server-modernized-remediation-master-checklist.md` と `server-modernized-remaining-closure-checklist-20260322.md` は完遂済みの Legacy/Archive として扱う

注意:
- 危険経路修正スコープでは、この文書を実装正本として扱う
- 既存 WBS や過去メモに、`d_module_payload`、attachment DATABASE mode、FIDO2、public fallback route を残す方向の古い作業案があっても採用しない
- 設計改善系の古いタスクは Phase2-A へ送る
- 現行の入口は `docs/server-modernization/planning/server-modernized-plan/README.md` → `docs/server-modernization/planning/server-modernized-plan/docs/README.md` → 本書の順で読む

---

## 0. この文書の使い方

- 1つの Patch Set が終わるまで、次の Patch Set に進まない
- 各 Patch Set は **別ブランチ** で作業する
- 各 Patch Set の最後に、この文書の「実行結果テンプレート」を埋める
- 迷ったら「危険経路を止める」側に倒す
- 迷っても **fallback を残す判断はしない**
- 迷っても **互換のために route を残さない**
- 迷っても **warning 付き成功** にしない
- 迷っても **prod-like で設定有効化を許さない**

---

## 1. 変更禁止ルール

### 1-1. 今回やってはいけないこと
- [ ] ORCA live view / local view の恒久 API 再設計を始めない
- [ ] 来院 state machine の全面実装を始めない
- [ ] mutation composite scope の全面適用を始めない
- [ ] truthful push/recovery を新設しない
- [ ] 後方互換のために old route / packed param / text/plain を残さない
- [ ] `d_module_payload` を生かす方向へ実装しない
- [ ] attachment DATABASE mode を残す方向へ実装しない
- [ ] FIDO2 を今リリースの正規経路として残さない
- [ ] password reset の cross-session revoke 恒久実装を中途半端に入れない

### 1-2. 今回やること
- [ ] 公開危険 route を止める
- [ ] prod-like 起動ガードを追加する
- [ ] facility missing ORCA call を fail-fast にする
- [ ] synthetic / local fallback を削る
- [ ] seed / demo artefact を削る
- [ ] TOTP-only に固定する
- [ ] module / attachment / image の正本契約を stopgap 固定する
- [ ] 必須回帰テストを通す

---

## 2. ブランチ運用

### 2-1. ブランチ名
- [ ] Patch Set 01: `dangerous-path-stopgap-01-public-routes`
- [ ] Patch Set 02: `dangerous-path-stopgap-02-startup-guards`
- [ ] Patch Set 03: `dangerous-path-stopgap-03-orca-facility-failfast`
- [ ] Patch Set 04: `dangerous-path-stopgap-04-security-bootstrap`
- [ ] Patch Set 05: `dangerous-path-stopgap-05-totp-only`
- [ ] Patch Set 06: `dangerous-path-stopgap-06-module-storage-contract`
- [ ] Patch Set 07: `dangerous-path-stopgap-07-cleanup-and-regression`

### 2-2. コミット粒度
- [ ] 1 Patch Set = 原則 1 PR
- [ ] route 停止と unrelated cleanup を同じ PR に混ぜない
- [ ] startup guard と unrelated business logic 変更を同じ PR に混ぜない
- [ ] migration と unrelated service refactor を同じ PR に混ぜない

---

## 3. 共通着手前チェック

### 3-1. 作業環境
- [ ] リポジトリ root に移動する
- [ ] `mvn -q -DskipTests compile` が現状で通るか確認する
- [ ] compile 失敗時は、今回触る範囲外の既知壊れかを確認する
- [ ] 壊れが今回範囲外なら blocker として記録して停止する

### 3-2. migration 正本
- [ ] DB 変更は `tools/flyway/sql` を正本として編集する
- [ ] ad-hoc SQL を別場所へ増やさない
- [ ] 既存 migration を上書きする場合は checksum 影響をメモする
- [ ] checksum 問題が出る変更は PR に手順を明記する

### 3-3. 実行前 grep
- [ ] `src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- [ ] `src/main/java/open/dolphin/rest/orca/OrcaMedicalOutpatientResource.java`
- [ ] `src/main/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResource.java`
- [ ] `src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java`
- [ ] `src/main/java/open/orca/rest/OrcaPatientDiseaseResource.java`
- [ ] `src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`
- [ ] `src/main/java/open/dolphin/orca/sync/OrcaPatientSyncScheduler.java`
- [ ] `src/main/java/open/dolphin/mbean/ServletStartup.java`
- [ ] `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- [ ] `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- [ ] `src/main/java/open/dolphin/security/integrity/DocumentIntegrityConfig.java`
- [ ] `src/main/java/open/dolphin/mbean/InitialAccountMaker.java`
- [ ] `src/main/java/open/dolphin/rest/RequestSecuritySupport.java`
- [ ] `src/main/java/open/dolphin/session/UserServiceBean.java`
- [ ] `src/main/java/open/dolphin/rest/SessionAuthResource.java`
- [ ] `src/main/java/open/dolphin/rest/support/UserMutationRequestMapper.java`
- [ ] `src/main/java/open/dolphin/rest/UserResource.java`
- [ ] `src/main/java/open/dolphin/storage/attachment/AttachmentStorageMode.java`
- [ ] `src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java`
- [ ] `src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`
- [ ] `src/main/java/open/dolphin/storage/image/ImageStorageManager.java`
- [ ] `src/main/java/open/dolphin/session/KarteDocumentWriteService.java`
- [ ] `src/main/java/open/dolphin/session/PatientImageServiceBean.java`

### 3-4. 停止条件
- [ ] 対象 source が見つからない場合は停止
- [ ] 仕様未確定項目を足したくなったら停止
- [ ] 変更範囲外の大量テスト失敗で原因不明なら停止
- [ ] migration が二重化しそうなら停止
- [ ] “互換のために残すかも” と思ったら停止して削る方向へ戻す

---

## 4. Patch Set 01 — 公開危険 route を止める

### 4-1. ブランチ作成
- [ ] `dangerous-path-stopgap-01-public-routes` を作成する

### 4-2. `OpenDolphinRestApplication` から public 登録を外す
対象ファイル:
- `src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`

削除対象:
- `open.dolphin.rest.orca.OrcaMedicalOutpatientResource.class`
- `open.dolphin.rest.orca.OrcaLocalMedicalOutpatientResource.class`
- `open.dolphin.rest.orca.OrcaDiseaseResource.class`
- `open.orca.rest.OrcaResource.class`
- `open.orca.rest.OrcaFacilityResource.class`
- `open.orca.rest.OrcaPatientDiseaseResource.class`
- `open.dolphin.rest.AdminAccessPasswordResetResource.class`

作業:
- [ ] 上記 7 class の登録行だけ削除する
- [ ] それ以外の登録順は触らない
- [ ] import 整理で不要 import が出たら削除する
- [ ] `classes` の `LinkedHashSet` 構成を壊さない
- [ ] `@ApplicationPath("/api")` は触らない

### 4-3. route 停止後の compile 修正
- [ ] route registration を外しただけで compile が通るか確認する
- [ ] compile 失敗時、未使用 import のみ整理する
- [ ] route path 文字列の rename はこの Patch Set ではしない

### 4-4. public exposure テスト修正
対象:
- `src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`

作業:
- [ ] 危険 route が public 登録されている前提 assertion を削除する
- [ ] 危険 route が **public には無い** ことを assert する
- [ ] `/api/health/readiness` が canonical である前提は維持する
- [ ] `/api/operations/readiness` が public 未登録であることを assert する

### 4-5. route inventory テストを追加
新規作成:
- `src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`

作業:
- [ ] `OpenDolphinRestApplication#getClasses()` を source of truth にする
- [ ] normalized `HTTP method + path template` の duplicate が 0 であることを確認する
- [ ] blocked public route が 0 であることを確認する
- [ ] `/api/orca/**` に `text/plain` producer が 0 であることを確認する
- [ ] `/api/operations/readiness` が public に無いことを確認する

blocked route 一覧:
- [ ] `GET /api/orca/disease/import/{*}`
- [ ] `GET /api/orca/disease/name/{*}`
- [ ] `GET /api/orca/disease/active/{*}`
- [ ] `GET /api/orca/facilitycode`
- [ ] `GET /api/orca/deptinfo`
- [ ] `GET /api/orca/tensu/shinku/{*}`
- [ ] `GET /api/orca/tensu/name/{*}`
- [ ] `GET /api/orca/tensu/code/{*}`
- [ ] `GET /api/orca/general/{*}`
- [ ] `GET /api/orca/stamp/{*}`
- [ ] `POST /api/orca/medical/outpatient`
- [ ] `POST /api/orca/local-medical/outpatient`
- [ ] `POST /api/admin/access/users/{*}/password-reset`
- [ ] `GET /api/operations/readiness`

### 4-6. Patch Set 01 テスト実行
- [ ] `mvn -Dtest=WebXmlEndpointExposureTest test`
- [ ] `mvn -Dtest=PublicRouteInventoryContractTest test`
- [ ] `mvn -q -DskipTests compile`

### 4-7. Patch Set 01 完了条件
- [ ] 上記 7 resource が public 404 になる
- [ ] duplicate public route テストが通る
- [ ] blocked public route テストが通る
- [ ] 他の public route を壊していない

---

## 5. Patch Set 02 — prod-like 起動ガードを追加する

### 5-1. ブランチ作成
- [ ] `dangerous-path-stopgap-02-startup-guards` を作成する

### 5-2. `ServerConfigurationResolver` の safe-default 修正
対象:
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`

作業:
- [ ] `orca.push.shadow-mode` の default を `false` に変更する
- [ ] `orca.push.recovery.enabled` の default を `false` に変更する
- [ ] `orca.push.enabled` default `false` は維持する
- [ ] `orca.patient-sync.enabled` default `false` は維持する
- [ ] `attachment.storage.mode` の default 追加はしない
- [ ] `document.integrity.mode` の default 追加はしない

### 5-3. `ServerConfigurationValidator` の strict 化
対象:
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`

作業:
- [ ] `validateAttachmentStorage(...)` で `database` を reject する
- [ ] `validateAttachmentStorage(...)` で `databaseLobTable` が設定されていたら mode に関係なく reject する
- [ ] `validateAttachmentStorage(...)` で `s3` のみ許可する
- [ ] `validateDocumentIntegrity(...)` で prod-like 以外の判定は追加しない。ここでは `off/permissive/enforce` の型検証だけに留める
- [ ] `validateFido2(...)` を今リリースの必須検証から外す
- [ ] `validateFido2(...)` 呼び出しを `validateOrThrow()` から削除する
- [ ] FIDO2 用 required エラーが startup で出ないことを確認する
- [ ] ただし FIDO2 設定が残っている prod-like は `ServletStartup` 側で reject する

### 5-4. `DocumentIntegrityConfig` の fail-open 廃止
対象:
- `src/main/java/open/dolphin/security/integrity/DocumentIntegrityConfig.java`

作業:
- [ ] `resolveMode()` の `raw == null -> PERMISSIVE` を廃止する
- [ ] `resolveMode()` の unknown 値 -> `PERMISSIVE` fallback を廃止する
- [ ] `resolveMode()` で unknown/null 時に `IllegalStateException` を投げるよう変更する
- [ ] warn log による permissive fallback を削除する
- [ ] `resolveSettings()` の既存 keyring validate は維持する

### 5-5. `ServletStartup` に prod-like startup fail を追加
対象:
- `src/main/java/open/dolphin/mbean/ServletStartup.java`

作業:
- [ ] `enforceStartupSecurityGuards()` に stopgap guard を追加する
- [ ] prod-like 判定を既存 environment 判定に合わせる
- [ ] prod-like で `orca.push.enabled=true` を reject する
- [ ] prod-like で `orca.push.shadow-mode=true` を reject する
- [ ] prod-like で `orca.push.recovery.enabled=true` を reject する
- [ ] prod-like で `orca.patient-sync.enabled=true` を reject する
- [ ] prod-like で `document.integrity.mode != enforce` を reject する
- [ ] prod-like で `fido2.rp.id` / `fido2.rp.name` / `fido2.allowed.origins` のいずれかが存在したら reject する
- [ ] prod-like で `attachment.storage.mode != s3` を reject する
- [ ] prod-like で `attachment.storage.database.lob-table` が存在したら reject する
- [ ] prod-like で `AdminAccessPasswordResetResource` を public 停止している前提メモをコメントで残す（実装は route stop 済み）
- [ ] 例外メッセージは設定キー名を含める

### 5-6. sample config 更新
対象:
- `config/server-modernized.env.sample`
- `config/attachment-storage.sample.yaml`

作業:
- [ ] `orca.push.shadow-mode=false` に更新する
- [ ] `orca.push.recovery.enabled=false` に更新する
- [ ] FIDO2 設定ブロックを削除する
- [ ] `attachment.storage.mode=s3` を前提にコメントを更新する
- [ ] `attachment.storage.database.lob-table` の sample を削除する
- [ ] `document.integrity.mode=enforce` を前提にコメントを更新する
- [ ] `document.integrity.keyring-path` 必須を明記する

### 5-7. Patch Set 02 テスト実行
- [ ] `mvn -Dtest=DocumentIntegrityConfigTest test`
- [ ] `mvn -Dtest=ServerConfigurationValidatorTest test`
- [ ] `mvn -Dtest=ServletStartupSecurityGuardTest test`
- [ ] `mvn -Dtest=ServerConfigurationResolverTest test`
- [ ] `mvn -Dtest=AttachmentStorageConfigLoaderTest test`
- [ ] `mvn -q -DskipTests compile`

### 5-8. Patch Set 02 完了条件
- [ ] prod-like で危険設定を有効化すると起動失敗になる
- [ ] FIDO2 required エラーは消える
- [ ] integrity unknown/null は起動失敗になる
- [ ] `attachment.storage.mode=database` は起動失敗になる

---

## 6. Patch Set 03 — ORCA facility missing を fail-fast にする

### 6-1. ブランチ作成
- [ ] `dangerous-path-stopgap-03-orca-facility-failfast` を作成する

### 6-2. `RestOrcaTransport` を fail-fast 化
対象:
- `src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`

作業:
- [ ] `resolveFacilityId()` をそのまま使い回さない
- [ ] `requireResolvedFacilityId()` か同等 helper を新設する
- [ ] helper は `resolveFacilityId()` の結果が null/blank/`default` 相当なら `IllegalStateException` を投げる
- [ ] `invoke(...)` の入口で helper を使う
- [ ] `invokeDetailed(...)` の入口で helper を使う
- [ ] `rawHttpClient()` / `buildOrcaUrl()` / `resolveBasicAuthHeader()` / `currentSettings()` / `auditSummary()` も helper を通す
- [ ] request edge で明示 facility を持つ経路は壊さない
- [ ] implicit/default facility 成功は残さない

### 6-3. `OrcaPatientSyncScheduler` の fallback 削除
対象:
- `src/main/java/open/dolphin/orca/sync/OrcaPatientSyncScheduler.java`

作業:
- [ ] `orcaRuntime().facilityId()` への fallback を削除する
- [ ] scheduler が facility を解決できない場合は例外にする
- [ ] prod-like では startup guard で scheduler 自体が禁止される前提をコメントで残す
- [ ] non-prod でも facility 明示なし実行は通さない

### 6-4. transport テスト修正
対象:
- `src/test/java/open/dolphin/orca/transport/RestOrcaTransportTest.java`

作業:
- [ ] `store.resolve(null)` や default facility 成功を前提とするテストを削除する
- [ ] facility missing -> exception を追加する
- [ ] explicit facility -> success を追加する
- [ ] Basic 認証ヘッダー生成の正路は維持する

### 6-5. Patch Set 03 テスト実行
- [ ] `mvn -Dtest=RestOrcaTransportTest test`
- [ ] `mvn -q -DskipTests compile`

### 6-6. Patch Set 03 完了条件
- [ ] facility missing ORCA call が runtime で即失敗する
- [ ] default facility 成功が消える
- [ ] request edge 明示 facility の経路は通る

---

## 7. Patch Set 04 — security / bootstrap の止血

### 7-1. ブランチ作成
- [ ] `dangerous-path-stopgap-04-security-bootstrap` を作成する

### 7-2. `InitialAccountMaker` を削除
対象:
- `src/main/java/open/dolphin/mbean/InitialAccountMaker.java`

作業:
- [ ] クラスを削除する
- [ ] 参照が残っていないか grep する
- [ ] packaging 後に class が WAR へ入らないことを確認する

### 7-3. demo seed 注入を削除
対象:
- `src/main/java/open/dolphin/session/SystemServiceBean.java`

作業:
- [ ] `addFacilityAdmin()` を開く
- [ ] `copyDemoPatients(...)` 呼び出しを削除する
- [ ] `copyStampTree(...)` 呼び出しを削除する
- [ ] 関連 private method が未使用になったら削除する
- [ ] 関連 query / constant が未使用になったら削除する
- [ ] facility/admin 作成の本筋は残す
- [ ] seed/demo を混ぜない

### 7-4. forwarded trust を一元化
対象:
- `src/main/java/open/dolphin/rest/RequestSecuritySupport.java`
- `src/main/java/open/dolphin/rest/AbstractResource.java`

作業:
- [ ] `RequestSecuritySupport` から無条件 `Forwarded` 信用をやめる
- [ ] `AbstractResource` の trusted proxy 判定ロジックを再利用できる形にする
- [ ] `isTrustedProxy(...)` 相当を package-private helper に昇格するか、`RequestSecuritySupport` 側から呼べるようにする
- [ ] untrusted remote の場合は `Forwarded` / `X-Forwarded-*` を無視する
- [ ] trusted proxy / loopback の場合だけ forwarded を採用する
- [ ] `isSecureRequest(...)`、`resolveExpectedOrigin(...)`、`shouldAttachHsts(...)` が同じ trust gate を使うよう統一する

### 7-5. password reset endpoint は stopgap では停止
対象:
- 既に Patch Set 01 で `OpenDolphinRestApplication` から削除済みであることを再確認
- `src/main/java/open/dolphin/rest/AdminAccessPasswordResetResource.java`

作業:
- [ ] class は今すぐ削除しなくてよい
- [ ] ただし public route から外れていることを再確認する
- [ ] code comment に「truthful session revoke 実装まで public 再公開しない」を残す
- [ ] `AdminAccessMutationSupport.resetPassword(...)` の現状 false revoke を README メモへ記録する
- [ ] この Patch Set では `session_revoked_after` 実装を始めない

### 7-6. Patch Set 04 テスト実行
- [ ] `mvn -Dtest=SecurityHeadersFilterTest test`
- [ ] `mvn -Dtest=CsrfProtectionFilterTest test`
- [ ] `mvn -Dtest=LogoutResourceTest test`
- [ ] `mvn -Dtest=SystemServiceBeanAddFacilityAdminTest test`
- [ ] packaging smoke を追加または更新して `InitialAccountMaker.class` 非同梱を確認する
- [ ] `mvn -q -DskipTests compile`

### 7-7. Patch Set 04 完了条件
- [ ] `InitialAccountMaker` がコードにも成果物にも残らない
- [ ] demo patient / stamp seed が admin 作成経路から消える
- [ ] untrusted forwarded spoof が HSTS / CSRF / logout secure 判定へ効かない
- [ ] password reset route は public 404 のまま

---

## 8. Patch Set 05 — 2FA を TOTP-only に固定する

### 8-1. ブランチ作成
- [ ] `dangerous-path-stopgap-05-totp-only` を作成する

### 8-2. `UserServiceBean` を strict 化
対象:
- `src/main/java/open/dolphin/session/UserServiceBean.java`

作業:
- [ ] `requiresSecondFactor(UserModel user)` を開く
- [ ] `off` のみ false、`totp` のみ true にする
- [ ] null/blank は false にするか、保存側で拒否する前提に合わせる
- [ ] `off` でも `totp` でもない値は **認証失敗** 側へ倒す
- [ ] “off 以外は全部 2FA 必須” をやめる

### 8-3. `SessionAuthResource` を dead-end 防止
対象:
- `src/main/java/open/dolphin/rest/SessionAuthResource.java`

作業:
- [ ] `factor2_required` を返す前に verified TOTP credential 存在確認 helper を追加する
- [ ] helper の配置は `SessionAuthResource` 内 private method か近傍 support method に限定する
- [ ] verified credential 不在なら fail-closed にする
- [ ] pending second-factor session を dead-end 状態で作らない
- [ ] unsupported mode の場合は 401/403 JSON へ倒す

### 8-4. `factor2Auth` 入力を止める
対象:
- `src/main/java/open/dolphin/rest/support/UserMutationRequestMapper.java`
- `src/main/java/open/dolphin/rest/UserResource.java`

作業:
- [ ] mapper で `factor2Auth` を取り込まない
- [ ] `UserResource` で `factor2Auth` 入力が来たら reject する
- [ ] success 風 `"0"` 文字列応答を増やさない
- [ ] この Patch Set では legacy `/user` の全面停止まではしない

### 8-5. FIDO2 runtime 依存を外す
対象:
- `src/main/java/open/dolphin/security/SecondFactorSecurityConfig.java`
- `src/main/java/open/dolphin/security/fido/Fido2Config.java`（存在する場合）
- `pom.xml`

作業:
- [ ] FIDO2 初期化コードを削る
- [ ] FIDO2 getter / bean が未使用なら削除する
- [ ] `pom.xml` から Yubico WebAuthn dependency を削除する
- [ ] compile 失敗時は FIDO2 参照を grep で潰す
- [ ] backup/challenge の public flow 接続が無いことを確認する

### 8-6. Patch Set 05 テスト実行
- [ ] `mvn -Dtest=SessionAuthResourceTest test`
- [ ] `mvn -Dtest=UserResourceTest test`
- [ ] `mvn -Dtest=ServerConfigurationValidatorTest test`
- [ ] `mvn -q -DskipTests compile`

### 8-7. Patch Set 05 完了条件
- [ ] `factor2Auth=off|totp` 以外が通らない
- [ ] verified TOTP credential 無しで `factor2_required` へ進まない
- [ ] FIDO2 dependency がビルドから消える

---

## 9. Patch Set 06 — module / attachment / image 契約を stopgap 固定する

### 9-1. ブランチ作成
- [ ] `dangerous-path-stopgap-06-module-storage-contract` を作成する

### 9-2. `d_module_payload` 停止
対象:
- `tools/flyway/sql/V0302__module_payload_table.sql`
- `tools/flyway/scripts/module-payload-migrate-once.sql`
- `tools/flyway/scripts/module-payload-verify.sql`
- `tools/flyway/scripts/run-module-payload-migration.sh`
- `tools/flyway/README.md`

作業:
- [ ] `V0302__module_payload_table.sql` を reserved/no-op 化する
- [ ] file 名は変えない
- [ ] script 3 本を削除する
- [ ] README の `d_module_payload` 使用手順を削除する
- [ ] `bean_json` 正本固定を README に明記する
- [ ] `d_module_payload` を正規 runtime 前提にしない

### 9-3. startup validator を追加
新規:
- `src/main/java/open/dolphin/runtime/config/StoragePersistenceContractValidator.java`
- `src/test/java/open/dolphin/runtime/config/StoragePersistenceContractValidatorTest.java`

作業:
- [ ] validator を新規作成する
- [ ] `d_module_payload` テーブルが存在したら fail にする
- [ ] external-only 契約違反を検知したら fail にする
- [ ] `ServletStartup` から validator を呼ぶ
- [ ] DB 接続不可時の扱いは既存 DB readiness / startup 流儀に合わせる
- [ ] validator の責務を “契約違反検知のみ” に限定する

### 9-4. attachment mode を external-only 固定
対象:
- `src/main/java/open/dolphin/storage/attachment/AttachmentStorageMode.java`
- `src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java`

作業:
- [ ] `AttachmentStorageMode` から `DATABASE` を削除する
- [ ] `AttachmentStorageMode.from(String)` は `S3` 以外で `IllegalArgumentException` を投げるよう変更する
- [ ] blank -> DATABASE fallback を削除する
- [ ] unknown -> DATABASE fallback を削除する
- [ ] `AttachmentStorageConfigLoader` で `database` を reject する
- [ ] `databaseLobTable` が来たら reject する
- [ ] valid `s3` のみ通す

### 9-5. storage manager の成功風 no-op をやめる
対象:
- `src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`
- `src/main/java/open/dolphin/storage/image/ImageStorageManager.java`

作業:
- [ ] non-S3 で `isBackendReachable() == true` になる経路をやめる
- [ ] non-S3 で `persistExternalAssets(...)` no-op をやめる
- [ ] non-S3 で `prepareExternalAssetForPersist(...) == false` だけ返す経路をやめる
- [ ] unsupported mode は例外にする
- [ ] backend unreachable は readiness DOWN か startup fail に倒す
- [ ] “使えないが成功扱い” を残さない

### 9-6. `KarteDocumentWriteService` の post-persist externalize 停止
対象:
- `src/main/java/open/dolphin/session/KarteDocumentWriteService.java`

作業:
- [ ] `finalizePersistedDocument(...)` を確認する
- [ ] persist 後に attachment/image を外出しする経路を止める
- [ ] persist 前に `uri + digest` が揃っていない attachment は reject する
- [ ] persist 前に `uri + digest` が揃っていない schema image は reject する
- [ ] stopgap では pre-externalized artifact のみ通す
- [ ] generic chart attachment/image の pre-upload 新設はこの Patch Set では行わない
- [ ] `uri + digest` が無いものは persist 前に fail-fast にする

### 9-7. patient image upload/download の inline fallback 停止
対象:
- `src/main/java/open/dolphin/session/PatientImageServiceBean.java`
- `src/main/java/open/dolphin/rest/PatientImagesResource.java`
- `src/main/java/open/dolphin/rest/PatientImagesSupport.java`
- `src/main/java/open/dolphin/storage/attachment/AttachmentKeyResolver.java`

作業:
- [ ] upload 時、`prepareExternalAssetForPersist(...)` 失敗なら例外にする
- [ ] upload 時、inline `contentBytes` fallback をやめる
- [ ] `AttachmentKeyResolver` の `unknown-doc` / `unknown-att` を stopgap 安全キーへ変える
- [ ] `pending/<facility>/<patient>/<uuid>` など衝突しない一時キーを採用する
- [ ] download 時、`uri` が無いとき inline bytes で救済しない
- [ ] `PatientImagesResource` の `hasInlineBytes` 分岐を削る
- [ ] `PatientImagesSupport.toStreamingAttachment(...)` が inline 前提を持たないようにする

### 9-8. readiness / config sample 整理
対象:
- `src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java`
- `config/server-modernized.env.sample`
- `config/attachment-storage.sample.yaml`

作業:
- [ ] attachment storage readiness で DATABASE mode を UP 扱いしない
- [ ] unsupported mode は DOWN/exception にする
- [ ] sample から DB LOB 前提を消す

### 9-9. Patch Set 06 テスト実行
- [ ] `mvn -Dtest=FreshSchemaBaselineTest test`
- [ ] `mvn -Dtest=AttachmentStorageConfigLoaderTest test`
- [ ] `mvn -Dtest=AttachmentStorageManagerTest test`
- [ ] `mvn -Dtest=PatientImageServiceBeanTest test`
- [ ] `mvn -Dtest=PatientImagesResourceTest test`
- [ ] `mvn -Dtest=StoragePersistenceContractValidatorTest test`
- [ ] `mvn -Dtest=OperationsHealthResourceTest test`
- [ ] `mvn -Dtest=KarteServiceBeanDocPkTest test` または新規 contract test を追加して実行する
- [ ] `mvn -q -DskipTests compile`

### 9-10. Patch Set 06 完了条件
- [ ] `d_module_payload` を作る/使う手順が消える
- [ ] `bean_json` 正本以外へ runtime が寄らない
- [ ] `attachment.storage.mode=database` が使えない
- [ ] inline fallback が消える
- [ ] patient image download が `uri + digest` 前提になる

---

## 10. Patch Set 07 — 残留 fallback 掃除と全体回帰

### 10-1. ブランチ作成
- [ ] `dangerous-path-stopgap-07-cleanup-and-regression` を作成する

### 10-2. synthetic visit を物理削除
対象:
- `src/main/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResource.java`

作業:
- [ ] `visits.isEmpty()` 時の fallback 分岐を削除する
- [ ] `buildFallbackVisit(...)` を削除する
- [ ] 実来院が無ければ `MISSING` のみ返す
- [ ] `dataSource=server` / `fallbackUsed=false` の嘘を作らない
- [ ] class は残してよいが `OpenDolphinRestApplication` に再登録しない

### 10-3. disease local fallback を fail-closed 化
対象:
- `src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java`

作業:
- [ ] ORCA datasource unavailable 時の local disease list 返却を削除する
- [ ] import/read は fail-closed にする
- [ ] mutation が local write であるなら public 再公開しない前提コメントを残す
- [ ] bare `diagnosisId` update/delete の危険性を TODO ではなく design-wait メモへ逃がす
- [ ] この Patch Set で public route を戻さない

### 10-4. old config / build artefact cleanup
対象:
- `target/`
- `__MACOSX`
- zip 展開ゴミ
- ignore 設定

作業:
- [ ] repo に build 成果物が混ざっていれば掃除する
- [ ] `.gitignore` / 配布物メモを更新する
- [ ] source 配布物と生成物を分離する
- [ ] stopgap patch と無関係な大掃除はしない

### 10-5. 全体回帰テスト
- [ ] `mvn -q -DskipTests compile`
- [ ] `mvn test`（重すぎる場合は下記必須セット）
- [ ] `WebXmlEndpointExposureTest`
- [ ] `PublicRouteInventoryContractTest`
- [ ] `RestOrcaTransportTest`
- [ ] `ServletStartupSecurityGuardTest`
- [ ] `DocumentIntegrityConfigTest`
- [ ] `ServerConfigurationValidatorTest`
- [ ] `AttachmentStorageConfigLoaderTest`
- [ ] `AttachmentStorageManagerTest`
- [ ] `OrcaLocalMedicalOutpatientResourceTest`
- [ ] `OrcaDiseaseResourceTest`
- [ ] `SecurityHeadersFilterTest`
- [ ] `CsrfProtectionFilterTest`
- [ ] `LogoutResourceTest`
- [ ] `SessionAuthResourceTest`
- [ ] `UserResourceTest`
- [ ] `PatientImageServiceBeanTest`
- [ ] `PatientImagesResourceTest`
- [ ] `FreshSchemaBaselineTest`

### 10-6. grep 最終確認
- [ ] `rg "buildFallbackVisit" src` が 0 件
- [ ] `rg "fallback to permissive|Fallback to permissive" src` が 0 件
- [ ] `rg "AttachmentStorageMode\\.DATABASE|\\bDATABASE\\b" src/main/java/open/dolphin/storage src/main/java/open/dolphin/runtime/config` が 0 件または reject 専用箇所のみ
- [ ] `rg "fido2\\." src config pom.xml` が 0 件または startup reject 専用箇所のみ
- [ ] `rg "d_module_payload" tools src` が validator / reserved コメント以外 0 件
- [ ] `rg "AdminAccessPasswordResetResource.class" src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java` が 0 件
- [ ] `rg "OrcaMedicalOutpatientResource.class|OrcaLocalMedicalOutpatientResource.class|OrcaDiseaseResource.class|OrcaResource.class|OrcaFacilityResource.class|OrcaPatientDiseaseResource.class" src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java` が 0 件

### 10-7. Patch Set 07 完了条件
- [ ] synthetic visit が物理削除されている
- [ ] ORCA disease local fallback が fail-closed になっている
- [ ] build artefact 汚染が増えていない
- [ ] 必須回帰が通る

---

## 11. 設計待ちへ送るもの（今回やらない）

### 11-1. Phase2-A へ回す項目
- [ ] 来院 encounter key + state machine
- [ ] mutation composite scope 全面適用
- [ ] ORCA live view / local view 正式分離
- [ ] truthful push/recovery 再設計
- [ ] password reset の truthful session revoke
- [ ] audit chain 線形化
- [ ] `d_module_payload` 物理 DROP migration
- [ ] attachment/image canonical field の恒久整理
- [ ] ORCA adapter 本設計

### 11-2. 今回の PR に書くこと
- [ ] 「設計待ちへ送るもの」に手を出していないこと
- [ ] route / startup / runtime の 3 層 stop で止血したこと
- [ ] public に戻した route が無いこと
- [ ] fallback を残していないこと

---

## 12. prod-like 起動禁止条件（最終確認用）

- [ ] `orca.push.enabled=true`
- [ ] `orca.push.shadow-mode=true`
- [ ] `orca.push.recovery.enabled=true`
- [ ] `orca.patient-sync.enabled=true`
- [ ] `document.integrity.mode` 未設定
- [ ] `document.integrity.mode=off`
- [ ] `document.integrity.mode=permissive`
- [ ] `document.integrity.mode` unknown 値
- [ ] `document.integrity.keyring-path` 未設定 / relative / 非存在 / JSON 不正
- [ ] `fido2.rp.id` が存在
- [ ] `fido2.rp.name` が存在
- [ ] `fido2.allowed.origins` が存在
- [ ] `attachment.storage.mode` 未設定
- [ ] `attachment.storage.mode=database`
- [ ] `attachment.storage.mode` unknown 値
- [ ] `attachment.storage.database.lob-table` が存在
- [ ] `d_module_payload` が DB に存在
- [ ] external-only 契約違反が DB に存在

---

## 13. 実行結果テンプレート

### Patch Set 実行結果
- 実行日:
- Patch Set:
- ブランチ:
- 完了 / 未完 / blocker:
- 主な変更ファイル:
- 実施テスト:
- 失敗テスト:
- 次回先頭 Patch Set:
- 補足メモ:

### blocker 記録テンプレート
- 発生日:
- Patch Set:
- blocker 内容:
- 影響範囲:
- 再現手順:
- 今回止血で扱う / 扱わない:
- 次アクション:
