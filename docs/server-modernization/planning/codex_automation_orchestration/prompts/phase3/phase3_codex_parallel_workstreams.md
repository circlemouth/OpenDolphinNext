# OpenDolphinNext Phase3+ Parallel Codex Workstreams

## 依存関係と並列実行ルール
- WS1 は独立。
- WS2 は独立。
- WS3 は独立。
- WS4 は admin 周辺を広く触るので、WS5 と同時実行してよいが administration ディレクトリには入らないこと。
- WS5 は reception / patients / mocks のみ。
- WS6 は notes / `.env*` / QA scripts のみ。
- WS7 は server config / proxy header contract のみ。
- WS8 は reporting のみ。reporting source が checkout に存在しない場合は doc-only + blocker note で止める。

---

## WS1: root-level legacy route surface 縮小 + verify script の守備範囲是正
**Area:** web-client  
**Primary files (start here):**
- `web-client/src/AppRouter.tsx`
- `web-client/src/features/login/FacilityLoginEntry.tsx`
- `web-client/src/features/login/loginRouteState.ts`
- `web-client/src/features/login/__tests__/FacilityLoginEntry.test.tsx`
- `web-client/src/__tests__/AppRouter.login-redirect.test.tsx`
- `web-client/scripts/verify-no-removed-routes.mjs`
- `web-client/package.json`

### Checklist
- [ ] `LegacyRootRedirect` が現在どの root-level path を facility path へ再構成しているか inventory を残す
- [ ] `/` 以外の arbitrary root path を deep-link 維持しない実装へ縮小する
- [ ] 未認証時は `/login` へ、認証済み時は facility reception など固定 fallback へ寄せ、`/charts` や `/patients` を `/f/:facilityId/...` に再構成しない
- [ ] facility-scoped path と login redirect の current behavior は壊さない
- [ ] `FacilityLoginEntry` / `loginRouteState` の「旧URL」扱いを縮小し、arbitrary root path を旧 deep-link として案内しない
- [ ] `verify-no-removed-routes.mjs` のファイル名・script 名・ログ文言を、実際には blocked ORCA route string check であることが分かる形へ狭める
- [ ] package scripts と関連 test を更新する
- [ ] `/api/operations/readiness` や blocked outpatient route を reopen しない

### Acceptance
- [ ] root-level `/charts` `/patients` `/administration` 等へ直接来ても旧 deep-link を維持しない
- [ ] `/f/:facilityId/...` と `/login` / `/f/:facilityId/login` の current intent は維持
- [ ] verify script 名称から「public route 全体を守っている」誤解が減る
- [ ] 対象 test / typecheck / build 前 hook が通る

### Suggested validation
- `cd web-client && npm test -- --run src/features/login/__tests__/FacilityLoginEntry.test.tsx src/__tests__/AppRouter.login-redirect.test.tsx`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run build`

---

## WS2: chart-event legacy AsyncContext fallback 削除
**Area:** server-modernized realtime  
**Primary files:**
- `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/mbean/ServletContextHolder.java`
- `server-modernized/src/test/java/open/dolphin/session/ChartEventServiceBeanNotifyEventTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/ChartEventStreamResourceTest.java`

### Checklist
- [ ] `AsyncContext` / `addAsyncContext` / `removeAsyncContext` / `getAsyncContextList` の repo usage を inventory する
- [ ] `ChartEventServiceBean.notifyEvent` から legacy fallback dispatch を削除する
- [ ] `ServletContextHolder` の legacy AsyncContext list と API を削除する
- [ ] SSE 経路のみを前提に test を更新する
- [ ] fallback 前提の stale comment / deprecation を掃除する

### Acceptance
- [ ] chart event realtime delivery は SSE path だけになる
- [ ] AsyncContext long-poll helper が repo から消える
- [ ] SSE broadcast の current test は維持または強化される

### Suggested validation
- `cd server-modernized && mvn -Dtest=ChartEventServiceBeanNotifyEventTest,ChartEventStreamResourceTest test`

---

## WS3: dead server legacy resource stack 削除
**Area:** server-modernized public-surface cleanup  
**Primary files:**
- `server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/OperationsReadinessResourceTest.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalOutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java`
- `server-modernized/src/main/java/open/orca/rest/OrcaResource.java`
- `server-modernized/src/main/java/open/orca/rest/OrcaFacilityResource.java`
- `server-modernized/src/main/java/open/orca/rest/OrcaPatientDiseaseResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`

### Checklist
- [ ] 未登録 class / helper / unit test の usage inventory を作る
- [ ] `OperationsReadinessResource` とそれ専用 unit test / stale constant を削除する
- [ ] blocked public route 専用の dead ORCA resource を削除する
- [ ] dead resource 専用 helper / test を連鎖削除する。ただし current registered route で使う code は消さない
- [ ] inventory / exposure contract tests は維持し、必要なら削除後の class list へ合わせて更新する
- [ ] `/api/operations/readiness` 再実装や blocked outpatient fallback 復活はしない

### Acceptance
- [ ] repo に「未登録前提の public resource 実装」が残らない
- [ ] current registered route に必要な helper は維持される
- [ ] contract tests が green

### Suggested validation
- `cd server-modernized && mvn -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,OperationsReadinessResourceTest,OrcaLocalMedicalOutpatientResourceTest,OrcaDiseaseResourceTest,open.orca.rest.OrcaResourceTest test`

---

## WS4: admin config / delivery 二重面の解消 + client/server 契約縮小
**Area:** web-client + server-modernized administration  
**Primary files:**
- `web-client/src/features/administration/api.ts`
- `web-client/src/features/administration/AdministrationPage.tsx`
- `web-client/src/features/administration/delivery/AdminDeliveryConfigCard.tsx`
- `web-client/src/features/administration/delivery/DeliveryDashboard.tsx`
- `web-client/src/features/shared/AdminBroadcastBanner.tsx`
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/plugins/flagged-mock-plugin.ts`
- `server-modernized/src/main/java/open/dolphin/rest/AdminConfigResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigSnapshot.java`
- `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigStore.java`
- `server-modernized/src/test/java/open/dolphin/rest/AdminConfigResourceTest.java`

### Checklist
- [ ] `/api/admin/config` と `/api/admin/delivery` の current overlap を inventory する
- [ ] client fetch を単一路線へ寄せ、`fetchEffectiveAdminConfig()` と `syncMismatch` 系ロジックを削減または廃止する
- [ ] server 側の `/api/admin/delivery` を削除し、`/api/admin/config` を単一正本にする
- [ ] client form / payload / response の field を backend-supported contract に縮小する
- [ ] `useMockOrcaQueue` を admin config 契約から除去する
- [ ] `mswEnabled` を persisted admin config として持つ必要がなければ除去する
- [ ] `chartsMasterSource` は server contract を正本とし、UI/observability が別語彙を必要とする場合は edge conversion へ閉じ込める
- [ ] administration UI / charts page / plugin / tests を同期更新する

### Acceptance
- [ ] admin config の取得元は 1 endpoint
- [ ] client/server で不存在 field や不可能な enum をやり取りしない
- [ ] `syncMismatch` を存在しない差分管理として残さない
- [ ] target tests が green

### Suggested validation
- `cd web-client && npm test -- --run src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx`
- `cd web-client && npm run typecheck`
- `cd server-modernized && mvn -Dtest=AdminConfigResourceTest test`

---

## WS5: product runtime の `.mock` route surface を消し、MSW は実 route 横取りへ限定
**Area:** web-client runtime/mocks  
**Primary files:**
- `web-client/src/features/reception/api.ts`
- `web-client/src/features/patients/api.ts`
- `web-client/src/mocks/handlers/outpatient.ts`
- `web-client/src/mocks/fixtures/outpatient.ts`
- search target: `'/mock'` under `web-client/src`

### Checklist
- [ ] product runtime code に見えている `/api/orca/.../mock` 候補を全 inventory する
- [ ] reception / patients / related APIs から `.mock` candidate route を削除する
- [ ] dev/test の mock behavior は実 route を MSW が intercept する形に寄せる
- [ ] `.mock` 専用 handler / fixture / test を削除または実 route に統合する
- [ ] admin config workstream と重複しない範囲で、runtime contract から `.mock` surface を消す

### Acceptance
- [ ] product code から `/mock` ORCA route string が消える
- [ ] dev/test の mock flow は実 route interception で維持される
- [ ] reception / patients 関連 tests が green

### Suggested validation
- `cd web-client && rg "/mock" src/features src/mocks`
- `cd web-client && npm test -- --run src/features/outpatient src/features/patients`
- `cd web-client && npm run typecheck`

---

## WS6: stale auth docs / env / QA scaffold cleanup
**Area:** web-client docs/scripts  
**Primary files:**
- `web-client/notes/auth-check.md`
- `web-client/.env.sample`
- `web-client/.env.stage.example`
- `web-client/.env.prod.example`
- search targets: `VITE_ENABLE_LEGACY_HEADER_AUTH`, `VITE_ALLOW_LEGACY_HEADER_AUTH_FALLBACK`, `devPasswordMd5`

### Checklist
- [ ] current runtime が legacy auth env を本当に読んでいるか inventory する
- [ ] `auth-check.md` を current session + factor2 contract に合わせて rewrite または archive 化する
- [ ] dead auth env flags が runtime で未使用なら `.env*` から削除する
- [ ] QA scripts の `VITE_ENABLE_LEGACY_HEADER_AUTH=1` と `devPasswordMd5` 注入を洗い、未使用なら retire / cleanup する
- [ ] Basic / legacy header auth を current contract のように読める記述を除去する

### Acceptance
- [ ] docs/env/scripts が current auth contract を誤読させない
- [ ] repo に dead legacy auth switch が残らない
- [ ] 変更した QA script / web docs の lint or smoke が通る

### Suggested validation
- `cd web-client && rg "VITE_ENABLE_LEGACY_HEADER_AUTH|VITE_ALLOW_LEGACY_HEADER_AUTH_FALLBACK|devPasswordMd5|Authorization Basic" .`
- `cd web-client && npm run typecheck`

---

## WS7: server security/config contract drift 修正
**Area:** server-modernized config/runtime  
**Primary files:**
- `server-modernized/config/server-modernized.env.sample`
- `server-modernized/src/main/java/open/dolphin/rest/OrcaApiProxySupport.java`
- `server-modernized/src/test/java/open/dolphin/rest/OrcaApiProxySupportTest.java`
- `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationValidatorTest.java`
- `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`

### Checklist
- [ ] `SECURITY_TRUSTED_PROXIES` の sample comment を validator の required contract と一致させる
- [ ] ORCA response header forwarding を explicit opt-in に寄せる
- [ ] default behavior / sample / tests を同期更新する
- [ ] 既存の fail-closed posture を崩さない狙い撃ち test を追加または更新する
- [ ] CSRF / logout / 2FA / attachment storage / document integrity を broad に触らない

### Acceptance
- [ ] sample comment と validator/test が矛盾しない
- [ ] X-Orca-* / Api-Result-Message header forwarding は明示設定なしで有効にならない
- [ ] target unit tests が green

### Suggested validation
- `cd server-modernized && mvn -Dtest=OrcaApiProxySupportTest,ServerConfigurationValidatorTest,ServerConfigurationResolverTest test`

---

## WS8: reporting contract / README rewrite（source inventory 付き）
**Area:** server-modernized reporting  
**Primary files:**
- `server-modernized/reporting/README.md`
- `server-modernized/reporting/signing-config.sample.json`
- `server-modernized/pom.xml`
- `pom.server-modernized.xml` (reference only if available in working tree)
- `server-modernized/src/test/java/open/dolphin/security/SecurityDefensiveCopyTest.java`
- actual reporting module source/tests if present in the real checkout

### Checklist
- [ ] まず actual terminal checkout に reporting 実装 source があるか inventory する
- [ ] source がある場合: signed export の production-like policy を明確化し、TSA/signing failure 時の outcome を fail-closed へ寄せる
- [ ] source がある場合: TSA unreachable / invalid key / signature required の black-box or integration test を追加する
- [ ] source がなくても: README を repo-truth のみへ rewrite する
- [ ] unreproducible doc/workflow/reference を README から外す
- [ ] template precedence と absolute path requirement を README に明記する
- [ ] `signing-config.sample.json` の field rename は行わない。必要なら README で補足する
- [ ] source 不在で hard-fail 実装に踏み込めない場合は `unknown` blocker note を短く残す

### Acceptance
- [ ] README が repo 現物で再現できる内容だけを述べる
- [ ] source が存在する場合は signing failure policy が test で固定される
- [ ] source が存在しない場合は、doc rewrite + blocker note で推測実装を避ける

### Suggested validation
- `cd server-modernized && mvn -Dtest=SecurityDefensiveCopyTest test`
- reporting module source がある場合は、その module の relevant tests も実行
