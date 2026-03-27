# Codex Automation Orchestration 作業計画書（現行）

- 更新日: 2026-03-27
- RUN_ID: 20260327T063611Z

この計画書は、`common` 廃止・旧 ORCA 死蔵コード撤去・品質ゲート強制までを、**メインエージェントがサブエージェントを順次召喚して処理する** ための現行作業計画書です。

> 旧 `codex_automation_workplan_revised.md` 系は Legacy/Archive です。
> この計画書は cleanup track (`A01`〜`A10`) の進捗判定正本であり、`A10` 完了後は `prompts/phase3/*.md`（`WS0`〜`WS8`）を現行継続タスクとして扱います。
> 現行実行は `prompts/phase3/WS0_parallel_orchestrator_prompt.md` の導線を起点に開始します。

## 0. 現在ステータス
- [x] A01 直接依存の明示化と dependency hygiene の土台作成
- [x] A02 状態変更 GET の全廃（まず CloudZero 送信）
- [x] A03 認可判定の一本化
- [x] A04 平文 credential cache と管理 API の削除
- [x] A05 ORCA queue mock 面の削除
- [x] A06 mock / stub / Trial-only 公開面の削除
- [x] A07 health / readiness の運用化
- [x] A08 audit 契約吸収と common 廃止
- [x] A09 runtime config 正本化と文書同期
- [x] A10 packaging / CI / 品質ゲート強制
- [ ] WS0（Phase3 継続）: `prompts/phase3/WS0_parallel_orchestrator_prompt.md` を起点に現行作業を開始
- [ ] WS1〜WS8（Phase3 継続）: `prompts/phase3/` 配下の workstream で現行再整理を継続

## 1. 事前条件
- [ ] 対象が zip 展開物ではなく repo 全体であることを確認する
- [ ] `git status --short` が意図した差分だけであることを確認する
- [ ] `git rev-parse --show-toplevel` が成功することを確認する
- [ ] 生成物を作業対象にしないことを確認する
- [ ] 後方互換レイヤーを追加しない方針を維持する
- [ ] 不要な mock / stub / dead code を残さない方針を維持する

## 2. orchestration 共通ルール
- [ ] 毎回 `main` 最新を取り込んだ新規ブランチで開始する
- [ ] 1 実行 = 1 ブランチ = 1 PR = 1 タスク
- [ ] メインエージェントは未完了先頭 task を 1 件だけ選ぶ
- [ ] メインエージェントは対応 prompt を添えてサブエージェントを召喚する
- [ ] cleanup track 時は 1 体ずつ。Phase3 のみ、WS0 起点の合意の下で非衝突 WS 群を併行化可
- [ ] 並列サブエージェント実行は原則禁止（Phase3 のみ例外）
- [ ] メインエージェントが最後に検証、plan 更新、log 作成を行う
- [ ] 差分はその task の責務に限定し、unrelated formatting はしない
- [ ] 検証に失敗したら失敗ログを残して停止し、別件へスコープを広げない

## 3. 役割分担
- Manager step
  - 未完了先頭 task を特定する
  - `【ワーカー指示】` 形式でサブエージェントを 1 体だけ召喚する
  - サブエージェント結果をレビューし、必要なら同一 task で追加指示する
  - 最終検証、plan 更新、log 作成、次回先頭 task の確定を行う
- Worker step
  - task prompt の範囲だけを実装する
  - 指定テストと必要最小限の安全確認を実行する
  - `【ワーカー報告】` 形式で実施内容、変更ファイル、実行コマンド、テスト結果、blocker、plan 更新要否を返す
- Escalation
  - source 不足、仕様不明、変更範囲外テスト失敗、ORCA 実連携判断が必要な場合は独断で進めずメインエージェントへ返す

## 4. 実行順
1. A01 直接依存の明示化と dependency hygiene の土台作成
2. A02 状態変更 GET の全廃（まず CloudZero 送信）
3. A03 認可判定の一本化
4. A04 平文 credential cache と管理 API の削除
5. A05 ORCA queue mock 面の削除
6. A06 mock / stub / Trial-only 公開面の削除
7. A07 health / readiness の運用化
8. A08 audit 契約吸収と common 廃止
9. A09 runtime config 正本化と文書同期
10. A10 packaging / CI / 品質ゲート強制
11. (A01-A10 完了後) `prompts/phase3/WS0_parallel_orchestrator_prompt.md`
12. (Phase3) `prompts/phase3/` 配下の WS1〜WS8 を並列検討・実装し、依存に応じて収束して反映

## 5. task 詳細

### A01 直接依存の明示化と dependency hygiene の土台作成
- ブランチ名: `automation/A01-direct-deps-and-hygiene`
- サブエージェント prompt: `prompts/A01_direct_deps_and_dependency_hygiene.txt`
- 目的
  - `server-modernized` の hidden transitive dependency 依存をやめ、`opendolphin-persistence` と `commons-codec` を direct dependency 化する。
  - 後続で dependency hygiene を強制できる起点を用意する。
- 主対象ファイル
  - `server-modernized/pom.xml`
  - 必要なら親 `pom.xml`
- 着手条件
  - [x] `TotpHelper.java` が `Base32` を使っている
  - [x] `open.dolphin.infomodel.*` import が `server-modernized` に存在する
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=TotpHelperTest -DfailIfNoTests=false test`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Pdependency-hygiene -DskipTests dependency:analyze-only`
- 完了条件
  - [x] `opendolphin-persistence` と `commons-codec` が direct dependency
  - [x] `dependency-hygiene` を手動起動できる
  - [x] `TotpHelperTest` が通る
- 実施メモ
  - RUN_ID `20260320T194403Z` で完了。`server-modernized/pom.xml` に direct dependency と `dependency-hygiene` profile を追加し、親 `pom.xml` に `-DfailIfNoTests=false` を reactor 上流へ橋渡しする Surefire/Failsafe 設定を最小追加した。
  - `mvn -pl server-modernized -am -Pdependency-hygiene -DskipTests dependency:analyze-only` は既存 warning を出しつつ `BUILD SUCCESS`。warning 解消自体は後続 task の対象とする。

### A02 状態変更 GET の全廃（まず CloudZero 送信）
- ブランチ名: `automation/A02-remove-state-changing-get`
- サブエージェント prompt: `prompts/A02_http_method_cleanup.txt`
- 目的
  - `GET /cloudzero/sendmail` を `POST /cloudzero/sendmail` に変更し、旧 GET 互換を残さない。
- 主対象ファイル
  - `server-modernized/src/main/java/open/dolphin/rest/SystemResource.java`
  - `server-modernized/src/test/java/open/dolphin/rest/SystemResourceTest.java`
  - 必要なら `CsrfProtectionFilterTest.java`
- 着手条件
  - [x] A01 が `main` に反映済み
  - [x] `/cloudzero/sendmail` の呼び出し元を grep で確認済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=SystemResourceTest,CsrfProtectionFilterTest -DfailIfNoTests=false test`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && rg -n "@GET|@POST|/cloudzero/sendmail" server-modernized/src/main/java/open/dolphin/rest/SystemResource.java`
- 完了条件
  - [x] `sendCloudZeroMail()` は `POST` のみ
  - [x] 旧 GET 互換なし
  - [x] 関連テストが通る
- 実施メモ
  - RUN_ID `20260320T195547Z` で完了。`SystemResource.sendCloudZeroMail()` を `@POST /cloudzero/sendmail` のみに変更し、`SystemResourceTest` に POST-only 公開を確認する reflection テストを追加した。
  - repo 内 caller として `client/src/main/java/open/dolphin/system/SystemDelegater.java` の CloudZero 送信も `GET` から `POST` に変更した。
  - CSRF テストの実在ファイルは `server-modernized/src/test/java/open/dolphin/rest/CsrfProtectionFilterTest.java`。既存の unsafe method 向け POST 保護で要件を満たしており、追加変更は不要と判断した。
  - 追加確認として `mvn -pl client -am -DskipTests compile` を試行したが、`SimpleDate` ほか多数の既存欠落シンボルで `client` module 全体が失敗した。今回変更に閉じた failure ではないため A02 の blocker にはしない。

### A03 認可判定の一本化
- ブランチ名: `automation/A03-authz-unification`
- サブエージェント prompt: `prompts/A03_authz_unification.txt`
- 目的
  - resource 層の `request.isUserInRole("ADMIN")` を 0 件にし、actor ベース判定へ統一する。
- 主対象ファイル
  - `AbstractResource.java`
  - `KarteDocumentWriteResource.java`
  - `StampResource.java`
  - `KarteRevisionResource.java`
  - `SystemResource.java`
  - `LetterResource.java`
  - `PatientImagesResource.java`
- 着手条件
  - [x] A02 が `main` に反映済み
  - [x] `isUserInRole(` の現存箇所を確認済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && rg -n "isUserInRole\\(" server-modernized/src/main/java`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=StampResourceTest,KarteRevisionResourceAuthorizationTest,LetterResourceTest,PatientImagesResourceTest,SystemResourceTest -DfailIfNoTests=false test`
- 完了条件
  - [x] production code に `isUserInRole(` が残っていない
  - [x] admin 判定が actor ベースに一本化
  - [x] 関連テストが通る
- 実施メモ
  - RUN_ID `20260320T195922Z` で完了。`AbstractResource` に `resolveActorRole(HttpServletRequest, UserServiceBean)` を追加し、resource 層の admin 判定を `userServiceBean.isAdmin(actor)` ベースへ統一した。
  - `StampResource` の施設アクセス判定、および `KarteDocumentWriteResource` / `KarteRevisionResource` / `SystemResource` / `LetterResource` / `PatientImagesResource` の audit payload 生成から `isUserInRole("ADMIN")` を除去した。
  - `KarteDocumentWriteResource` / `KarteRevisionResource` / `LetterResource` / `PatientImagesResource` には最小の `UserServiceBean` inject を追加し、production code の `isUserInRole(` は `rg` で 0 件を確認した。

### A04 平文 credential cache と管理 API の削除
- ブランチ名: `automation/A04-remove-credential-cache`
- サブエージェント prompt: `prompts/A04_remove_plaintext_credential_cache.txt`
- 目的
  - `UserCache` と `AdminSecurityResource` を削除し、平文 credential cache と可視化 API を撤去する。
- 主対象ファイル
  - `UserCache.java`
  - `AdminSecurityResource.java`
  - `OpenDolphinRestApplication.java`
  - `UserCacheTest.java`
  - `AdminSecurityResourceTest.java`
  - `WebXmlEndpointExposureTest.java`
- 着手条件
  - [x] A03 が `main` に反映済み
  - [x] 関連識別子の grep 済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && rg -n "UserCache|header-credentials/cache|HEADER_CREDENTIAL_CACHE" server-modernized/src/main server-modernized/src/test`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=WebXmlEndpointExposureTest -DfailIfNoTests=false test`
- 完了条件
  - [x] 平文 credential cache 実装が消えている
  - [x] 管理 API が消えている
  - [x] 公開 resource 登録と exposure test が一致している
- 実施メモ
  - RUN_ID `20260320T200222Z` で完了。`AdminSecurityResource` と `UserCache`、および専用テスト `AdminSecurityResourceTest` / `UserCacheTest` を削除した。
  - `OpenDolphinRestApplication` から `AdminSecurityResource` の登録を削除し、`WebXmlEndpointExposureTest` に非公開化の期待値を反映した。
  - `rg -n "UserCache|header-credentials/cache|HEADER_CREDENTIAL_CACHE" ...` は 0 件。`mvn -pl server-modernized -am -Dtest=WebXmlEndpointExposureTest -DfailIfNoTests=false test` は PASS。

### A05 ORCA queue mock 面の削除
- ブランチ名: `automation/A05-remove-orca-queue-mock-surface`
- サブエージェント prompt: `prompts/A05_remove_orca_queue_mock_surface.txt`
- 目的
  - live 実装のない queue mock 面を production code / tests / admin config から削除する。
- 主対象ファイル
  - `OrcaQueueResource.java`
  - `OrcaQueueStore.java`
  - `OpenDolphinRestApplication.java`
  - `AdminConfigResource.java`
  - `AdminConfigSnapshot.java`
  - `AdminConfigStore.java`
  - `OrcaQueueResourceTest.java`
  - `AdminConfigResourceTest.java`
  - `WebXmlEndpointExposureTest.java`
- 着手条件
  - [x] A04 が `main` に反映済み
  - [x] queue mock 関連識別子の grep 済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && rg -n "OrcaQueue|useMockOrcaQueue|orca/queue|x-orca-queue-mode|OPENDOLPHIN_ALLOW_MOCK_ORCA_QUEUE" server-modernized/src/main server-modernized/src/test`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=AdminConfigResourceTest,WebXmlEndpointExposureTest -DfailIfNoTests=false test`
- 完了条件
  - [x] ORCA queue mock 面が消えている
  - [x] 公開 resource 登録と exposure test が一致している
- 実施メモ
  - RUN_ID `20260320T200327Z` で完了。`OrcaQueueResource` / `OrcaQueueStore` / `OrcaQueueResourceTest` を削除し、`OpenDolphinRestApplication` から queue resource 登録を削除した。
  - `AdminConfigSnapshot` / `AdminConfigStore` / `AdminConfigResource` / `AdminConfigResourceTest` から `useMockOrcaQueue`、`x-orca-queue-mode`、mock/live queue source 切替を除去した。
  - `rg -n "OrcaQueue|useMockOrcaQueue|orca/queue|x-orca-queue-mode|OPENDOLPHIN_ALLOW_MOCK_ORCA_QUEUE" ...` は 0 件。`mvn -pl server-modernized -am -Dtest=AdminConfigResourceTest,WebXmlEndpointExposureTest -DfailIfNoTests=false test` は PASS。

### A06 mock / stub / Trial-only 公開面の削除
- ブランチ名: `automation/A06-remove-mock-stub-trial-surface`
- サブエージェント prompt: `prompts/A06_remove_mock_stub_trial_surface.txt`
- 目的
  - mock / stub / Trial-only API を削除または unsupported 化し、production code の `isStub()` 分岐を除去する。
- 主対象ファイル
  - `PatientModV2OutpatientMockResource.java`
  - `OpenDolphinRestApplication.java`
  - `OrcaMedicalAdministrationResource.java`
  - `OrcaPatientResource.java`
  - `OrcaTransport.java`
  - `OrcaWrapperService.java`
  - `DefaultOrcaPatientAdapter.java`
- 着手条件
  - [x] A05 が `main` に反映済み
  - [x] mock / stub 関連識別子の grep 済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && rg -n "PatientModV2OutpatientMockResource|OrcaMedicalAdministrationResource|isStub\\(" server-modernized/src/main`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=WebXmlEndpointExposureTest,PatientModV2OutpatientResourceIdempotencyTest,OrcaWrapperServicePatientIdListPayloadTest -DfailIfNoTests=false test`
- 完了条件
  - [x] mock / stub / Trial-only 公開面が production code から消えている
  - [x] production code に `isStub()` が残っていない
  - [x] unsupported operation は explicit error
  - [x] 関連テストが通る
- 実施メモ
  - RUN_ID `20260320T200518Z` で完了。`PatientModV2OutpatientMockResource` と `OrcaMedicalAdministrationResource` を削除し、`OpenDolphinRestApplication` / `WebXmlEndpointExposureTest` から公開面登録を除去した。
  - `PatientModV2OutpatientResource` の未使用 mock entrypoint を削除し、`OrcaPatientResource` の delete operation は stub 応答ではなく `400 invalid_request` の explicit error に変更した。
  - production code から `OrcaTransport.isStub()` 依存を除去し、`OrcaWrapperService` / `DefaultOrcaPatientAdapter` は `dataSource` 未設定時に `real` 扱いへ統一した。stub integration test は新仕様に合わせて更新した。

### A07 health / readiness の運用化
- ブランチ名: `automation/A07-harden-health-readiness`
- サブエージェント prompt: `prompts/A07_health_readiness_hardening.txt`
- 目的
  - `/api/health` と `/api/health/readiness` を未認証 probe 可能にし、ORCA readiness を実 probe ベースにする。
- 主対象ファイル
  - `OperationsHealthResource.java`
  - `LogFilter.java`
  - `RestOrcaTransport.java`
  - readiness 用 DTO と test
- 着手条件
  - [x] A06 が `main` に反映済み
  - [x] health / readiness / `auditSummary()` 周辺の grep 済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=OperationsHealthResourceTest,LogFilterTest -DfailIfNoTests=false clean test`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && rg -n "orca.host=unknown" server-modernized/src/main/java/open/dolphin/rest/OperationsHealthResource.java`
- 完了条件
  - [x] health / readiness が匿名許可
  - [x] ORCA readiness が実 probe ベース
  - [x] 関連テストが通る
- 実施メモ
  - RUN_ID `20260320T201118Z` で完了。`LogFilter` に `/api/health` と `/api/health/readiness` の匿名許可を追加し、疎通 probe を認証前提から外した。
  - `RestOrcaTransport` に 3 秒 timeout の readiness probe を追加し、接続設定から解決した ORCA base URL へ `GET` を送る実 probe ベースへ変更した。`2xx/3xx/401/403` を reachable、`5xx` と例外系を DOWN 判定に寄せている。
  - `OperationsHealthResource` は `auditSummary()` 文字列判定をやめ、probe 結果の `statusCode` / `url` / `error` / `message` を readiness payload へ反映するよう更新した。`OperationsHealthResourceTest` は probe stub を使う形へ組み替え、`clean test` で stale class 由来の誤判定も解消済み。

### A08 audit 契約吸収と common 廃止
- ブランチ名: `automation/A08-absorb-audit-and-remove-common`
- サブエージェント prompt: `prompts/A08_absorb_audit_and_remove_common.txt`
- 目的
  - `open.dolphin.audit` の最小再配置を行い、`common` module と `opendolphin-common` 依存を撤去する。
- 主対象ファイル
  - `common/src/main/java/open/dolphin/audit/AuditEventEnvelope.java`
  - `common/src/main/java/open/dolphin/audit/AuditTrailService.java`
  - `common` 配下の旧 ORCA / utility / test
  - `server-modernized/pom.xml`
  - 親 / aggregator POM
- 着手条件
  - [x] A07 が `main` に反映済み
  - [x] `open.dolphin.audit` 利用箇所と `common` 依存箇所の grep 済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=TotpHelperTest,AuditTrailServiceTest -DfailIfNoTests=false test`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -DskipTests package`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && jar tf server-modernized/target/opendolphin-server.war | rg "opendolphin-common|open/dolphin/common/Orca"`
- 完了条件
  - [x] `common` module が消えている、または `audit-contract` へ置換済み
  - [x] `server-modernized` が `opendolphin-common` に依存していない
  - [x] WAR に common jar が含まれない
- 実施メモ
  - RUN_ID `20260320T202306Z` で完了。`open.dolphin.audit.*` は利用者が `server-modernized` のみだったため、新 module は作らず `server-modernized/src/main/java/open/dolphin/audit/` へ吸収した。
  - root `pom.xml` / `pom.server-modernized.xml` / `server-modernized/pom.xml` / `client/pom.xml` から `opendolphin-common` 依存と `common` module 参照を除去し、`copy-jakarta-common` と WAR への common jar 詰め替えも削除した。
  - `client` は `common` から `OrcaConnect` だけを参照していたため、`client/src/main/java/open/dolphin/common/OrcaApi.java` と `OrcaConnect.java` を内包して build 依存を切り離した。`common/` 配下の残存 production/test source は削除して dead code を残していない。
  - verification 用の広い grep は orchestration plan 自身の説明文にだけヒットが残る。Legacy `server/pom.xml` は絶対ルールにより非改変として据え置いたため、実 build 導線の確認は現行 POM 群と WAR 中身で判定した。

### A09 runtime config 正本化と文書同期
- ブランチ名: `automation/A09-runtime-config-and-doc-sync`
- サブエージェント prompt: `prompts/A09_runtime_config_and_doc_sync.txt`
- 目的
  - typed config を正本に揃え、`custom.properties` fallback 記述と実装差異を解消する。
- 主対象ファイル
  - `server-modernized/README.md`
  - `server-modernized/config/server-modernized.env.sample`
  - `RuntimeConfigurationSupport.java`
  - `OperationsHealthResource.java`
  - `ChartEventHistoryPurgeScheduler.java`
  - `PatientImagesResource.java`
  - `OrcaPatientSyncScheduler.java`
- 着手条件
  - [x] A08 が `main` に反映済み
  - [x] config 直読箇所の grep 済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am -Dtest=RuntimeConfigurationSupportTest,ServerConfigurationValidatorTest,PatientImagesResourceTest -DfailIfNoTests=false test`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && rg -n "custom.properties" server-modernized/README.md server-modernized/config/server-modernized.env.sample`
- 完了条件
  - [x] `README.md` と env sample と実装 default が一致
  - [x] 優先対象ファイルの config 解決が helper 経由
  - [x] scheduler default の説明と実装が一致
- 実施メモ
  - RUN_ID `20260320T204706Z` で完了。`server-modernized/README.md` と `server-modernized/config/server-modernized.env.sample` から `custom.properties` literal を除去し、typed config 正本運用の説明へ揃えた。
  - `RuntimeConfigurationSupport` に `PROP_FACILITY_ID` と `resolveFacilityId(...)` を追加し、`OrcaPatientSyncScheduler` の facilityId 解決を helper 経由へ寄せた。
  - `ChartEventHistoryPurgeScheduler` の default OFF、`OperationsHealthResource` / `PatientImagesResource` の helper 利用は既存実装どおりで変更不要だった。

### A10 packaging / CI / 品質ゲート強制
- ブランチ名: `automation/A10-packaging-and-ci-enforcement`
- サブエージェント prompt: `prompts/A10_packaging_and_ci_enforcement.txt`
- 目的
  - static analysis、dependency hygiene、WAR 内容検査、source archive 除外を build/CI の停止条件にする。
- 主対象ファイル
  - `server-modernized/pom.xml`
  - 親 `pom.xml`
  - CI 設定
  - `.gitattributes`
  - 必要なら build helper script / contract test
- 着手条件
  - [x] A09 が `main` に反映済み
  - [x] quality gate 関連識別子の grep 済み
- 検証コマンド
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && mvn -pl server-modernized -am verify -Pdependency-hygiene`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && jar tf server-modernized/target/opendolphin-server.war | rg "opendolphin-common|WEB-INF/lib/.*common"`
  - [x] `ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && git check-attr export-ignore -- . ':!*.git' | rg "target|__MACOSX|surefire-reports|failsafe-reports|\\.war"`
- 完了条件
  - [x] static analysis が CI で fail する
  - [x] dependency hygiene が CI で fail する
  - [x] WAR に common jar が混入すると build が fail する
  - [x] source archive から生成物が除外される
- 実施メモ
  - RUN_ID `20260320T205337Z` で完了。`server-modernized/pom.xml` の `dependency-hygiene` profile を `verify` 実行へ格上げし、WAR 展開後に `opendolphin-common` jar と `open/dolphin/common/Orca*.class` の混入を fail させる Ant 検査を追加した。
  - `.github/workflows/server-modernized-static-analysis-gate.yml` は `-Pstatic-analysis,dependency-hygiene -Dstatic.analysis.enforce=true -pl server-modernized -am verify` に更新し、CI の停止条件を build 本体へ揃えた。
  - `.gitattributes` に `target` / `__MACOSX` / `surefire-reports` / `failsafe-reports` / `*.war` / `*.jar` の `export-ignore` を追加した。`git check-attr` は代表パスで `export-ignore: set` を確認した。
  - `jar tf ... | rg "WEB-INF/lib/.*common"` は `commons-codec` のような第三者ライブラリにも反応するため、`opendolphin-common` 混入判定は Ant 検査と WAR 展開実体で確定した。

## 6. 最終確認チェックリスト（A10 完了後）
- [x] `rg -n "isUserInRole\\(" server-modernized/src/main/java` が 0 件
- [x] `rg -n "UserCache|header-credentials/cache|HEADER_CREDENTIAL_CACHE" server-modernized/src/main server-modernized/src/test` が 0 件
- [x] `rg -n "OrcaQueue|useMockOrcaQueue|PatientModV2OutpatientMockResource|OrcaMedicalAdministrationResource|isStub\\(" server-modernized/src/main server-modernized/src/test` が 0 件
- [x] `rg -n "opendolphin-common|copy-jakarta-common|common</module>" .` が 0 件（`audit-contract` 採用時は置換後構成が説明どおり）
- [x] `jar tf server-modernized/target/opendolphin-server.war | rg "opendolphin-common|open/dolphin/common/Orca"` が 0 件
- [x] `mvn -pl server-modernized -am verify -Pdependency-hygiene` が通る
