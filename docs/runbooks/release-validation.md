# Release Validation

## 目的
本番投入前に、`web-client` と `server-modernized` の現行契約、設定、静的検証、最小 smoke が揃っていることを確認する。

## 事前確認
- `docs/contracts/` が今回の変更を反映している。
- `docs/architecture/` の summary が current contract と矛盾していない。
- `docs/managerdocs/` の release/readiness 説明が gate と矛盾していない。
- `config/server-modernized.env.sample` が設定契約と一致している。
- `target/` / `*.war` / `__MACOSX` / `.DS_Store` / `Thumbs.db` をレビュー対象に含めない。

## 必須コマンド
```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

## ORCA是正 最終受入れの実行順
1. route taxonomy / wording drift を grep で確認する。
```bash
rg -n "/api/orca/official/|/api/orca/master/|/api/local/" web-client server-modernized docs
rg -n "症状詳記（ORCA）|ORCAへ反映|今すぐ同期|認証済み|一括疎通（グループ）" web-client docs
rg -n "medicalInformation \\?\\? '01'|medicalInformation \\|\\| '01'" web-client/scripts
rg -n "medicalmodv23" web-client server-modernized docs
```
期待結果:
- taxonomy grep は current route と docs 正本だけを返し、legacy alias や blocked route を返さない。
- `/api/orca/queue` と `/api/orca/pusheventgetv2` は current taxonomy route としては返さず、`web-client/src/features/outpatient/orcaQueueApi.ts` の production fail-close sentinel と `web-client/src/mocks/handlers/orcaQueue.ts` の mock/test-only legacy route surface にだけ残る。
- wording grep は deny/assertion test 以外に stale wording を返さない。
- `medicalInformation ?? '01'` / `medicalInformation || '01'` は 0 hit。
- `medicalmodv23` は 0 hit。

2. server contract / inventory / exposure tests を current taxonomy で実行する。
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,AdminOrcaUserResourceTest,AdminOrcaUserLinkResourceTest,OrcaAppointmentResourceTest,OrcaChartSupportResourceTest,OrcaChartSupportSupportTest,OrcaLiveGatewaySupportTest \
  test
```
期待結果:
- `PublicRouteInventoryContractTest` が `official=/api/orca/official/*`、`master=/api/orca/master/*`、`local=/api/local/*`、`admin-internal=/api/admin/internal/*` の inventory を固定できる。
- `WebXmlEndpointExposureTest` が `/api/*` 以外の public exposure を拒否し、`/api/orca/*` 直下を official/master のみに制限できる。
- `patientlst3v2` / `visitptlstv2` / `manageusersv2` / `contraindicationcheckv2` / `medicationgetv2` / `incomeinfv2` の XML 契約が current shape に一致する。

3. patients official/local 境界の focused regression を実行する。
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=PatientModV2OutpatientSupportTest,PatientModV2OutpatientResourceIdempotencyTest \
  test
cd web-client && npm test -- --run \
  src/features/patients/__tests__/api.test.ts \
  src/features/patients/__tests__/PatientsPage.test.tsx \
  src/features/outpatient/__tests__/orcaPatientImportApi.test.ts \
  src/features/charts/__tests__/PatientInfoEditDialog.test.tsx
```
期待結果:
- local search は `/api/local/patients/search` だけを使い、official create/update/import と導線を混在させない。
- `PatientsPage` は create/update/import を別 mutation として扱い、成功後 canonical re-fetch/local sync の UI 証跡を残す。
- `PatientInfoEditDialog` は official update route を使い、成功後 callback で canonical/local sync refresh を進める。
- server-side patientmodv2 tests は class=01 create、class=02 update、変更なし時の ORCA 再取込を固定する。

4. web-client targeted UI / semantics tests を current wording で実行する。
```bash
cd web-client && npm test -- --run \
  src/features/reception/__tests__/ReceptionPage.test.tsx \
  src/features/charts/__tests__/PatientInfoEditDialog.test.tsx \
  src/features/charts/__tests__/OrcaSummary.semantics.test.tsx \
  src/features/charts/__tests__/SoapNotePanel.test.tsx \
  src/features/charts/__tests__/chartsActionBar.test.tsx \
  src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx \
  src/features/administration/__tests__/AdministrationPage.connection.test.tsx \
  src/features/administration/__tests__/AdministrationPage.internalWrapper.test.tsx \
  src/features/patients/__tests__/PatientsPage.test.tsx
```
期待結果:
- Patients / Reception / Charts / Admin の wording が current contract と一致する。
- Reception の `visits/mutation` browser payload は `medicalInformation` を UI 選択時だけ送り、未選択時は field 自体を送信しない。
- `症状詳記（院内ローカル）`、official/local 境界、disabled reason が current UI copy と一致する。

5. web-client gate と full CI を実行する。
```bash
cd web-client && npm run verify:web-guard
cd web-client && npm run ci
```
期待結果:
- blocked route string / legacy auth drift / public secret の再混入がない。
- `verify-no-blocked-orca-route-strings.mjs` は `web-client/src` だけでなく `web-client/scripts`、`web-client/plugins`、`tests`、`docs/contracts`、`docs/runbooks`、`docs/releases`、`docs/implementation` を走査する。存在しない root は明示 skip、存在する root の走査失敗は fail。
- guard success message は category counts を表示し、`server public route`、`client production fail-close sentinel`、`MSW mock/test-only legacy route surface`、`e2e fixture/test-only surface`、`blocked-route detector`、`docs/reference` の分類で current tree の残存 route string を説明できる。
- guard allowlist は `path + route + category + reason` で管理され、allowlist にない `/api/orca/queue` または `/api/orca/pusheventgetv2` は failure。`/api/orca/(official|master 以外)` の新規 route、および production source に混入した mock/test-only legacy route surface も failure。
- `server public route` は `/api/orca/official/*` と `/api/orca/master/*` だけを意味する。client fail-close sentinel、MSW mock/test-only legacy route surface、e2e fixture/test-only surface、blocked-route detector、docs/reference は public route ではない。
- typecheck / test / build まで成功する。

6. runtime-ready smoke と ORCA smoke scripts を pair release 前提で実行する。
```bash
cd web-client && node scripts/runtime-ready-smoke.mjs
curl -sk https://127.0.0.1:8443/openDolphin/api/orca/official/appointments/medical-information
cd web-client && node scripts/qa-weborca-candidate-discovery.mjs
cd web-client && QA_PATIENT_ID=<summary.phase3AttemptPatientId> node scripts/qa-acceptmodv2-weborca.mjs
cd web-client && QA_PATIENT_ID=<summary.phase3AttemptPatientId> node scripts/qa-fullflow-weborca.mjs
```
期待結果:
- web-client と server-modernized を同じ remediation pair として起動した状態で成功する。
- `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` は Vite PID だけを成功条件にしない。`https://localhost:5173/` が連続して応答し、dev server process が生存していることを setup log に残す。
- `runtime-ready-smoke` は current local smoke seed を前提に動作する。smoke seed 不一致で受付行が現れない場合は repo defect と決め打ちせず、`tests/runtime-ready-smoke.log` を保存して `test-data-blocker` または `environment-blocker` として切り分ける。
- local smoke seed の既定キーは `encounterKey=1.3.6.1.4.1.9414.72.103:SMOKE-20251129-0001`、`scheduleKey=SMOKE-SCHEDULE-20251129-0001`、`DEV_SMOKE_PATIENT_ID=0000001`、Asia/Tokyo 当日 `09:00` の `scheduled_datetime` とする。`DEV_SMOKE_PATIENT_ID` を変更する場合は schedule / encounter projection が同じ患者を指すことを確認する。
- `runtime-ready-smoke` は `/api/orca/queue` と `/api/orca/pusheventgetv2` を current public route とみなさず、browser request が出た場合は blocked route hit として failure にする。
- `appointments/medical-information` の direct probe で `system01lstv2 Request_Number=06` 相当の応答可否を smoke 前に evidence 化する。
- Phase 3 mutation の候補患者は `qa-weborca-candidate-discovery.mjs` で先に探索する。既定候補は WebORCA Trial native 候補 `00001`〜`00011` とし、`QA_WEBORCA_CANDIDATES` または `QA_CANDIDATE_PATIENT_IDS` で上書きできる。旧 local smoke seed `0000001` が渡された場合は warning 付き rejected row として扱い、Trial native candidate として採用しない。
- `qa-weborca-candidate-discovery.mjs` は read-only 限定で、official patient existence、insurance readiness、selector readiness、local selectable、appointment dependency、diagnostic no patient-not-found を candidate ごとに評価する。official 初期患者情報は category / count 程度に sanitization し、氏名・住所・電話番号・保険詳細など raw sensitive detail は summary / row に残さない。mutation 系 route が発火した場合は script 側で abort し、candidate を accepted にしない。
- discovery で `acceptedForPhase3Attempt` の最初の 1 件が見つかった場合だけ、同じ RUN_ID の `qa/weborca-readonly-preflight/summary.json` に sanitized row link を書き、`qa-acceptmodv2-weborca.mjs` の既定 preflight gate に渡す。候補 0 件の場合は `PARTIAL / TEST-DATA BLOCKER`、reason `no_trial_native_mutation_ready_candidate` として rejected preflight summary を残し、`qa-acceptmodv2-weborca.mjs` は実行しない。
- Phase 3 mutation の前に、`qa-weborca-candidate-discovery.mjs` が生成した preflight summary、または `QA_PATIENT_ID=<accepted candidate patientId> node scripts/qa-weborca-readonly-preflight.mjs` の追加確認のどちらかが accepted であることを必須とする。
- preflight summary は `trialSourceCandidate` / `officialPatientExistence` / `insuranceReadiness` / `selectorReadiness` / `localSelectableReadiness` / `appointmentDependency` / `acceptmodv2ReadOnlyDiagnostic` を分離し、`acceptedForPhase3Attempt=true` と `phase3AttemptPatientId` が揃った run だけ `qa-acceptmodv2-weborca.mjs` へ渡す。official `Patient_ID` は完全一致必須で、ゼロ埋め桁違いは一致扱いにしない。
- `insuranceReadiness` は count / effectiveCount / redacted selected combination id だけを summary に残し、保険番号・記号番号・氏名等を出さない。`localSelectableReadiness` が official exact match と一致しない場合は `local_sync_required` の `test-data-blocker` として止める。
- `appointmentDependency` は direct patient acceptance flow では required=false とし、予約行 absence だけを blocker にしない。`acceptmodv2ReadOnlyDiagnostic` は Request_Number=00 の read-only diagnostic として扱い、`apiResult=10` は rejected、`apiResult=60` は `no existing acceptance` diagnostic であって mutation success ではない。
- medical-information が HTTP 200 / `apiResult=00`、patient search が selectable、department / physician / visit kind / payment mode / medical-information select が存在することを accepted 条件とする。
- `visitptlstv2` は HTTP 200 でも `apiResult=13` なら business success として扱わない。read-only preflight では rejected / not verified として記録し、mutation 成功の代替 evidence にしない。
- `acceptmodv2` は endpoint-specific semantics で判定する。HTTP 200、`Api_Result=00` / `0000`、または all-zero generic parser だけでは mutation success としない。
- `acceptmodv2` の business accepted 条件は、`Api_Result=00` / `0000` と `Acceptance_Info`、`Acceptance_Id`、`Patient_Information`、server-generated `encounterKey` / `scheduleKey` 等の受付登録証跡が同じ response に存在すること。証跡がなければ `notVerified` として停止する。
- `acceptmodv2` の `Api_Result=K1/K2/K3` は official warning code として扱うが、受付登録証跡がある場合だけ `businessAcceptedWithWarnings` とする。`Api_Result_Message` だけ、または warning message だけでは accepted にしない。
- `acceptmodv2` の `Api_Result=10` は `businessRejected` / `patient_not_found`、`Api_Result=60` は `diagnosticNoExistingAcceptance` / `no_existing_acceptance` とし、どちらも mutation success の証跡にしない。
- `qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` の patient picker は current reception workflow に合わせて `/api/local/patients/search` を使う。固定 seed を正本とみなさず、実行直前に current facility で local search 可能かつ単一 active entry を作れる患者IDを確認して `QA_PATIENT_ID` に渡す。
- `qa-acceptmodv2-weborca.mjs` は既定で同じ `RUN_ID` の `qa/weborca-readonly-preflight/summary.json` を要求する。preflight artifact を別パスに置いた場合は `QA_READONLY_PREFLIGHT_SUMMARY` を渡し、preflight accepted でない run では mutation を実行しない。
- `qa-fullflow-weborca.mjs` は Phase 3 が business accepted になった後だけ実行する。
- 旧 closeout evidence の patientId や old RUN_ID を受入れ候補へ流用しない。current RUN_ID の rerun で local search 可否と active entry 解決性を取り直すこと。
- patient search が 0 件、または accept 後に canonical handoff 用の active entry を一意に解決できない場合は `test-data-blocker` として停止し、summary / network / console / page-errors を保存する。
- `qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` は `QA_MEDICAL_INFORMATION` 未指定時に `medicalInformation` を browser request body へ送らず、含まれた場合は script 自身が failure で停止する。指定時だけ current select option を送る。
- WebORCA Trial で `Acceptance_Push` workaround が必要な環境では、client 側ではなく server runtime config `ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH=true` を明示する。`setup-modernized-env.sh` の dev 起動はこの flag を既定で有効化する。
- artifact が `RUN_ID` 単位でまとまり、accept / fullflow / runtime-ready smoke の結果を同じ受入れ束へ添付できる。official `Voucher_Number` / `Sequential_Number` が不足する場合は fail-close のまま `official-visit-row-blocker` または `test-data-blocker` として summary / steps / network へ残す。
- fullflow が send 到達を示した run だけ `qa/fullflow/request-xml/medicalmodv2.xml` を必須とする。send 未到達 run では XML 不在を許容する代わりに、`summary.json`、`blocker-summary.json`、`handoff-state.json`、`selected-visit-row.json` で停止理由を third party が再読できることを必須とする。

7. current RUN_ID の closeout report を仕上げ、reviewer submission packet を生成・検証する。
```bash
./scripts/create-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <ACCEPTED_BRANCH>
./scripts/validate-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <ACCEPTED_BRANCH>
```
期待結果:
- `artifacts/orca-remediation/closeout/<RUN_ID>/reports/final-report.md`、`command-log.md`、`blocker-classification.md` が存在する。
- packet は `submission-packet-<RUN_ID>/README_REVIEW.md`、`manifest.json`、`review-checkout/.git/HEAD`、`closeout-packet/` を含む。
- `review-checkout/HEAD`、`closeout-packet/git/git-head-current.txt`、`manifest.json.acceptedHead` が一致する。
- packet 内テキストに絶対ローカルパスが残らない。
- `scripts/create-review-archive.sh` は reviewer 提出用の正本ではなく、受入れ手順に含めない。
- evidence freeze 後に accepted branch が別 commit を指した場合は、`--accepted-head <ACCEPTED_HEAD>` を付けて packet HEAD を固定する。

## Worker G の post-merge 確認
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test
cd web-client && node scripts/verify-no-blocked-orca-route-strings.mjs
```

- `PublicRouteInventoryContractTest` で official / master / local / admin-internal inventory が current taxonomy と一致することを確認する。
- `WebXmlEndpointExposureTest` で `/api/*` exposure と `/api/orca/*` taxonomy が崩れていないことを確認する。
- `verify-no-blocked-orca-route-strings.mjs` で repo-wide scanned roots の taxonomy drift や blocked mock surface が残っていないことを確認する。
- `/api/orca/queue` と `/api/orca/pusheventgetv2` は `orcaQueueApi.ts` の production fail-close sentinel、`src/mocks/handlers/orcaQueue.ts` の MSW mock/test-only legacy route surface、QA/e2e fixture、blocked-route detector、docs/reference の allowlist にだけ残り、guard success message も category counts で同じ分類を示すことを確認する。
- 上記 allowlist category は retained string の説明であり、public route として受け入れない。official/master 以外の `/api/orca/*` を新しい public route として追加した場合は release を止める。
- Reception / Patients / Charts / Admin の UI と server contract が taxonomy contract と一致していることを確認する。
- web-client と server-modernized を別々の remediation wave で混在 deploy しない。pair release で同時に切り替える。

## 補助コマンド
```bash
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-no-runtime-ddl.sh
bash server-modernized/tools/ci/check-persistence-entities.sh
bash server-modernized/tools/ci/check-no-generated-artifacts.sh --root "$(git rev-parse --show-toplevel)"
rg 'System\\.get(env|Property)|ConfigProvider\\.getConfig\\(' server-modernized/src/main/java -n
rg 'dolphin\\.facilityId' server-modernized -n
```

## 期待結果
- `npm run ci` が成功する。
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` が成功する。
- `runtime-ready-smoke` が成功する。
- `qa-weborca-candidate-discovery.mjs` が Trial native mutation-ready candidate を 1 件以上 accepted にし、同一 RUN_ID の preflight summary へ `acceptedForPhase3Attempt` をリンクする。その後に `qa-acceptmodv2-weborca.mjs` が current 受付導線で `businessAccepted` または `businessAcceptedWithWarnings` になる。`qa-fullflow-weborca.mjs` は Phase 3 business accepted 後にだけ実行し、`medicalInformation` 未選択時は browser request body 未送信の証跡を残す。未指定 run で request body に `medicalInformation` が含まれた場合は fail と判定される。
- patient search が 0 件なら、script は `QA_PATIENT_ID` の不足/不一致を明示したエラーで停止する。
- direct runtime lookup grep は `ServerConfigurationResolver.java` の `ConfigProvider.getConfig()` 1 件だけを返す。
- `dolphin.facilityId` grep は 0 件。

## 証跡保存先
- closeout 提出用の正本は `artifacts/orca-remediation/closeout/<RUN_ID>/`。
- runtime smoke は `artifacts/orca-remediation/closeout/<RUN_ID>/qa/runtime-ready/`。
- WebORCA candidate discovery は `artifacts/orca-remediation/closeout/<RUN_ID>/qa/weborca-candidate-discovery/`。
- read-only preflight は `artifacts/orca-remediation/closeout/<RUN_ID>/qa/weborca-readonly-preflight/`。
- accept smoke は `artifacts/orca-remediation/closeout/<RUN_ID>/qa/acceptmodv2/`。
- fullflow smoke は `artifacts/orca-remediation/closeout/<RUN_ID>/qa/fullflow/`。
- 最低限 `git/git-head-current.txt`、`git/git-branch-current.txt`、`reports/final-report.md`、`qa/acceptmodv2/accept-summary.json`、`qa/fullflow/summary.json`、`qa/fullflow/steps.log`、`qa/fullflow/network/network.json`、`qa/fullflow/network/requests.json`、`qa/fullflow/console.json`、`qa/fullflow/page-errors.json` を同一 RUN_ID へ揃える。
- ORCA 接続確認を別途行った場合は `artifacts/orca-connectivity/<RUN_ID>/` を併記し、closeout report から相互参照できるようにする。
- Worker G の smoke memo / diff / grep 結果は release 判定に使う artifact 配下へまとめ、cutover 記録と分離しない。

## 手動確認
### Health
- [ ] `GET /api/health` が最小 payload を返す。
- [ ] `GET /api/health/readiness` が匿名で sanitized detailed readiness (`status` と `checks`) を返す。
- [ ] `/api/health/readiness` に URL / host / port / scheme / username / statusCode / raw exception / stack trace / secret path が出ない。
- [ ] `/api/operations/readiness` は current resource として公開されず、追加時も匿名許可されない。

### ORCA connection
- [ ] 既定施設が明示設定されていない場合、facility 未解決で fail する。
- [ ] 施設 A の更新で施設 B へ影響しない。
- [ ] readiness / audit に URL / host / port が出ない。

### Document integrity
- [ ] active key を切り替えても旧文書が verify できる。
- [ ] `mode=enforce` で検証失敗時に 409 を返す。
- [ ] `mode=permissive` で検証失敗時に読み取り継続する。

### Patient images
- [ ] 一覧の `downloadUrl` が context-root 非依存である。
- [ ] 大きすぎる画像を 4xx で拒否する。
- [ ] MIME mismatch を 4xx で拒否する。
- [ ] upload/download の `Cache-Control` が `private, no-store` である。

### Schema / Build
- [ ] `src/main/java` に runtime DDL が存在しない。
- [ ] Flyway migration のみで必要テーブルが揃う。
- [ ] `server-modernized/pom.xml` に sibling source 追加 (`../api-contract/src/main/java`) が存在しない。
- [ ] `persistence.xml` の entity 明示列挙と `@Entity` 実装が一致する。

## Review / Archive
- reviewer 提出物は `git archive` ではなく reviewer submission packet を正本とする。
- `create-review-package.sh` の support zip は `.git/` を含まず、clean checkout truth を主張しない。clean checkout 判定は reviewer submission packet の `review-checkout/` に限定する。
- packet 生成は repo root から実行し、`review-checkout/` と `closeout-packet/` を分離同梱する。
- `closeout-packet/` の required file が欠けていたら fail する。欠落を別 zip や old RUN_ID で補わない。
- packet 生成後は `./scripts/validate-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <ACCEPTED_BRANCH>` を必ず通す。branch drift がある場合は create/validate の両方へ `--accepted-head <ACCEPTED_HEAD>` を付ける。
- reviewer が辿る path は packet-relative に統一し、絶対ローカルパスを残さない。

## 補足
- `check-no-generated-artifacts.sh` は tracked / untracked の両方を検査する。
- `check-no-direct-runtime-lookup.sh` は `ServerConfigurationResolver.java` 以外の direct runtime lookup を許可しない。
- どれか 1 つでも失敗したら release は見送る。
- cutover / rollback の実施順序と停止条件は [../releases/orca-remediation-cutover.md](../releases/orca-remediation-cutover.md) を正本とする。
