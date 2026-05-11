# Release Validation

## 目的
本番投入前に、`web-client` と `server-modernized` の現行契約、設定、静的検証、最小 smoke が揃っていることを確認する。

## 事前確認
- `docs/contracts/` が今回の変更を反映している。
- `docs/architecture/` の summary が current contract と矛盾していない。
- `docs/managerdocs/` の release/readiness 説明が gate と矛盾していない。
- ORCA outage / UNKNOWN recovery / DB read-only / backup restore reconciliation の運用手順は [orca-outage-recovery.md](./orca-outage-recovery.md) と `docs/contracts/orca-connection.md` が一致している。
- backup / restore / hash verification の運用手順は [backup-restore-hash-verification.md](./backup-restore-hash-verification.md) と `docs/contracts/audit-log.md` が一致し、restore 後の read-only 解除前に audit hash chain と chart/prescription content hash を検証する。
- production operations readiness の手順は [production-operations-readiness.md](./production-operations-readiness.md) と [../releases/orca-remediation-cutover.md](../releases/orca-remediation-cutover.md) が一致し、pair release、secret store、sanitized readiness、audit write path、object storage、rollback、reviewer packet evidence の stop condition を固定している。
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
bash server-modernized/tools/ci/check-no-legacy-disease-authority.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"
```
期待結果:
- taxonomy grep は current route と docs 正本だけを返し、legacy alias や blocked route を返さない。
- `/api/orca/queue` と `/api/orca/pusheventgetv2` は current taxonomy route としては返さない。残存 literal は guard category counts 上の production fail-close sentinel、MSW mock/test-only legacy route surface、e2e/QA fixture surface、blocked-route detector、docs/reference、server route inventory negative assertion、web.xml exposure negative assertion のいずれかで説明できること。
- wording grep は deny/assertion test 以外に stale wording を返さない。
- `medicalInformation ?? '01'` / `medicalInformation || '01'` は 0 hit。
- `medicalmodv23` は 0 hit。
- legacy disease authority guard が通り、active modernized roots に `diseasev2`、旧 CLAIM 病名送信、ORCA 患者病名 DB 直接参照が残っていない。
- finalized write guard が通り、確定済み診療録タイトル直接更新は 409 `karte.document.finalized_update_denied` で拒否され、処方保存/DO import は server-side `encounter_projection` の会計待ち・取消・閉鎖相当状態を payload 永続化前に 409 `prescription_order_finalized_update_denied` で拒否する。

2. server contract / inventory / exposure tests を current taxonomy で実行する。
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,AdminOrcaUserResourceTest,AdminOrcaUserLinkResourceTest,OrcaAppointmentResourceTest,OrcaChartSupportResourceTest,OrcaChartSupportSupportTest,OrcaLiveGatewaySupportTest,OrcaReportDocumentResourceTest,OrcaBillingCacheStoreTest,OperationsHealthResourceTest \
  test
```
期待結果:
- `PublicRouteInventoryContractTest` が `official=/api/orca/official/*`、`master=/api/orca/master/*`、`local=/api/local/*`、`admin-internal=/api/admin/internal/*` の inventory を固定できる。
- `WebXmlEndpointExposureTest` が `/api/*` 以外の public exposure を拒否し、`/api/orca/*` 直下を official/master のみに制限できる。
- `patientlst3v2` / `visitptlstv2` / `manageusersv2` / `contraindicationcheckv2` / `medicationgetv2` / `incomeinfv2` の XML 契約が current shape に一致する。
- `OrcaReportDocumentResourceTest` と `OrcaBillingCacheStoreTest` が ORCA帳票 snapshot / binary staging / server-generated storage key/digest / fail-closed persistence を固定し、`OperationsHealthResourceTest` が `orcaBillingCache` readiness を sanitized schema availability として固定できる。

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
- `check-sensitive-evidence-redaction.sh` が review-target の browser bundle / test-results / Playwright output / test snapshots に credential、Cookie、JSESSIONID、CSRF、raw ORCA body/XML、患者氏名・住所、保険番号 field、HAR、trace、video、screenshot、`error-context.md`、raw network JSON が混入していないことを確認する。
- `verify-no-blocked-orca-route-strings.mjs` は `server-modernized/src/test`、`web-client/src`、`web-client/scripts`、`web-client/plugins`、`tests`、`docs/contracts`、`docs/runbooks`、`docs/releases`、`docs/implementation` を走査する。存在しない root は明示 skip、存在する root の走査失敗は fail。
- guard success message は category counts を表示し、`production fail-close sentinel`、`MSW mock/test-only legacy route surface`、`e2e/QA fixture surface`、`blocked-route detector`、`docs/reference`、`server route inventory negative assertion`、`web.xml exposure negative assertion` の分類で current tree の残存 route string を説明できる。
- guard allowlist は `path + route + category + reason` で管理され、allowlist にない `/api/orca/queue` または `/api/orca/pusheventgetv2` は failure。`/api/orca/(official|master 以外)` の新規 route、および production source に混入した mock/test-only legacy route surface も failure。
- public route は `/api/orca/official/*` と `/api/orca/master/*` だけを意味する。production fail-close sentinel、MSW mock/test-only legacy route surface、e2e/QA fixture surface、blocked-route detector、docs/reference、server route inventory negative assertion、web.xml exposure negative assertion は public route ではない。
- `verify:no-direct-orca-proxy-config` が Vite config / env sample / tracked env files を検査し、生 ORCA/WebORCA path、ORCA credential/certificate variable、ORCA TLS bypass、ORCA header filtering config の web-client 再混入を failure にする。
- `verify:medical-safety-ui-copy` が production UI/current docs を検査し、ORCA送信成功と診療録確定/会計済み/登録済み/反映済みを混同する文言、`ORCAへ反映` / `会計へ反映`、重要警告を details/disclosure へ戻す記述の再混入を failure にする。
- typecheck / test / build まで成功する。

### Browser / fullflow artifact policy
この automation の browser e2e は、通常は artifact-free wrapper を使う。RWO-08 / RWO-08B fullflow については、owner approval recorded on 2026-04-24 により、既存 broad harness が screenshot / HAR / trace / video / raw network artifact を生成する場合でも診断目的で実行してよい。

診断 artifact は release evidence ではない。`artifacts/diagnostic-fullflow/<RUN_ID>/` または既存の ignored Playwright output に local-only / untracked として残し、reviewer submission packet へ同梱しない。commit できるのは sanitized extracted summary、blocker classification、endpoint/request-class identity、status class、route coverage、hash、console/page-error summary のみとする。credential、Cookie、Authorization、JSESSIONID、CSRF、raw ORCA body、raw patient detail、raw insurance detail、credential-bearing URL は tracked evidence にコピーしない。

RWO-02 以降の no-live browser smoke は、対象 spec を事前検査する wrapper から実行する。

```bash
PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --run-id <RUN_ID> \
  tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts \
  tests/e2e/safe-no-artifacts/local-clinical-persistence.safe.spec.ts
```

期待結果:
- wrapper が artifact-capturing fixture import、明示的 screenshot/HAR/trace/video/raw-network artifact 出力を含む spec を拒否する。
- `playwright.no-artifacts.config.ts` の `trace` / `screenshot` / `video` は `off`。
- wrapper は `PLAYWRIGHT_NO_COPY_PROMPT=1` を設定し、Playwright failure snapshot の `error-context.md` を生成・保持しない。
- 実行後に `test-results/no-artifacts` 配下へ HAR / trace / video / screenshot / raw network JSON / `error-context.md` が残らない。
- wrapper は Playwright の `.last-run.json` metadata を実行後に削除する。
- `local-clinical-persistence.safe.spec.ts` は browser-executed client modules による RWO-03 prescription save/reload/edit/delete/copy、RWO-04 representative generic order create/readback/update/delete、RWO-05 SOAP/disease local readback を検証し、`charts-missing-context-recovery.safe.spec.ts` は Charts UI の SOAP Free/S/O/A/P 保存、insurance disease create/update/delete、prescription save/update、representative treatment create/readback/update/delete を検証する。guarded ORCA endpoint は safe fixture の read-only allowlist 以外をブロックする。
- この suite は no-live browser gate の local persistence 証跡であり、full UI click-through、live Trial ORCA、fullflow、production ORCA、S3/object-storage readiness の代替証跡ではない。

6. runtime-ready smoke と ORCA smoke scripts を pair release 前提で実行する。
```bash
ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>
OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
cd web-client && node scripts/runtime-ready-smoke.mjs
curl -sk https://127.0.0.1:8443/openDolphin/api/orca/official/appointments/medical-information
cd web-client && node scripts/qa-weborca-candidate-discovery.mjs
cd web-client && QA_PATIENT_ID=<discovery.selectedCandidatePatientId> node scripts/qa-weborca-readonly-preflight.mjs
cd web-client && QA_PHASE3_APPROVED_MODE=1 QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 QA_PATIENT_ID=<readonly-preflight.phase3AttemptPatientId> node scripts/qa-acceptmodv2-weborca.mjs
cd web-client && QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 QA_PATIENT_ID=<summary.phase3AttemptPatientId> node scripts/qa-fullflow-weborca.mjs
```
期待結果:
- `ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>` が live ORCA Trial の実行順、必須 script、set/unset だけの secret 状態、sanitized evidence roots、hard stop を出力し、raw credential / raw ORCA body / PHI を表示しない。
- web-client と server-modernized を同じ remediation pair として起動した状態で成功する。
- `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage` は Trial 検証専用の non-S3 runtime profile。`ATTACHMENT_STORAGE_MODE=disabled` を生成し、MinIO profile を起動せず、`ATTACHMENT_STORAGE_S3_*` / `PHR_EXPORT_S3_*` / `MINIO_*` が既に設定されている場合は値を表示せず fail closed する。
- この profile では attachment storage / patient image storage / PHR export storage readiness は claim しない。保存系 route は fail closed、readiness は `attachment_storage_disabled` の sanitized reason を返す。RUN_ID `20260423T110051Z` 以降、storage-dependent features が disabled の場合は `attachmentStorage=DISABLED` 自体を overall readiness の失敗理由にしない。ただし patient image storage を有効化した状態で attachment storage が disabled の場合は `patient_images_storage_unavailable` で fail closed する。
- PowerShell 起動経路も bash と同じく、S3 attachment storage が有効な場合は Docker Compose の `object-storage` profile を起動し、MinIO を readiness 対象に含める。`MINIO_ROOT_PASSWORD` が未設定の場合はスクリプト実行中だけのランダム値を生成し、ログや成果物へ出力しない。
- `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` は Vite PID だけを成功条件にしない。setup script が表示する `Open Web Client at ...` の URL が連続して応答し、dev server process が生存していることを setup log に残す。Codex などのブラウザ自動化で localhost の IPv6-only 待受に詰まる場合は、`WEB_CLIENT_CODEX_BROWSER_COMPAT=1 WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` で Vite を `0.0.0.0` bind に切り替える。
- `runtime-ready-smoke` は受付一覧に ORCA 正式識別子を持たない local smoke seed が出ないことを前提にする。local projection が残っていても `officialVisitIdentifiers` の `Voucher_Number` / `Sequential_Number` / `Insurance_Combination_Number` 相当が揃わない行は official visit row とみなさず、表示されないことを正常系とする。
- `runtime-ready-smoke` は sanitized JSON-only evidence に限定し、screenshot / HAR / trace / video / raw network dump / `error-context.md` を生成・保持しない。RUN_ID `20260423T200259Z` 以降の retained file は `runtime-ready-before-row-wait.json` と `runtime-ready-result.json` だけを正本とする。診断 artifact 例外は RWO-08/RWO-08B fullflow harness に限る。
- 旧 local smoke seed の既定キーは `encounterKey=1.3.6.1.4.1.9414.72.103:SMOKE-20251129-0001`、`scheduleKey=SMOKE-SCHEDULE-20251129-0001`、`DEV_SMOKE_PATIENT_ID=0000001`、Asia/Tokyo 当日 `09:00` の `scheduled_datetime` だが、これは ORCA 連携済み row の証跡に使わない。受付一覧の mutation / handoff / billing 検証では、実行直前に WebORCA Trial の公式候補を探索し、accept 後に server-derived official identifiers が揃った row だけを採用する。
- `runtime-ready-smoke` は `/api/orca/queue` と `/api/orca/pusheventgetv2` を current public route とみなさない。blocked route detector として browser request が出た場合に failure にするもので、success route の証跡ではない。
- `appointments/medical-information` の direct probe で `system01lstv2 Request_Number=06` 相当の応答可否を smoke 前に evidence 化する。
- Phase 3 mutation の候補患者は `qa-weborca-candidate-discovery.mjs` で先に探索する。既定候補は WebORCA Trial 公式初期患者として登録済み前提の native 候補 `00001`〜`00011` とし、`QA_WEBORCA_CANDIDATES` または `QA_CANDIDATE_PATIENT_IDS` で上書きできる。旧 local smoke seed `0000001` が渡された場合は warning 付き rejected row として扱い、Trial native candidate として採用しない。
- `qa-weborca-candidate-discovery.mjs` は read-only 限定で、official patient existence、insurance readiness、selector readiness、local selectable、appointment dependency、diagnostic no patient-not-found を candidate ごとに評価する。candidate row には `insuranceReadiness.status/apiResult/classification/accepted` と `appointmentDependency.flowMode/required/status/apiResult/classification/accepted` を残す。official 初期患者情報は category / count 程度に sanitization し、氏名・住所・電話番号・保険詳細など raw sensitive detail は summary / row に残さない。mutation 系 route は exact selected-candidate preflight と同じ `mutationPolicy` allowlist で検出し、patientmodv2 create/update、appointments/visits mutation、acceptance operation、`medicalmodv2`、`diseasev3`、local billing send、temporary medical reconcile が発火した場合は script 側で abort し、candidate を accepted にしない。blocked request evidence は route template、method、固定 reason のみで、query、request body、患者 ID、保険 detail、credential、Cookie、Authorization、CSRF は summary に残さない。
- discovery で `acceptedForPhase3Attempt` の最初の 1 件が見つかった場合でも、その summary は sanitized selected-candidate proposal であり、Phase 3 handoff artifact には使わない。同じ RUN_ID / selected candidate で `qa-weborca-readonly-preflight.mjs` を実行し、exact selected-candidate preflight summary を別途生成する。
- `acceptedCandidateCount=0` は「公式初期患者が存在しない」という意味ではない。ORCA Trial 公式初期患者 `00001`〜`00011` は official initial data として存在するが、current evidence では mutation-ready ではない。zero accepted は current harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria により mutation-ready read-only evidence が未充足であることに限定する。この場合の verdict は `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER`、reason は `no_trial_native_mutation_ready_candidate` として rejected preflight summary を残し、`qa-acceptmodv2-weborca.mjs` は実行しない。
- Phase 3 mutation の前に、`QA_PATIENT_ID=<accepted candidate patientId> node scripts/qa-weborca-readonly-preflight.mjs` が生成した exact selected-candidate preflight summary だけを handoff artifact とする。`QA_READONLY_PREFLIGHT_SUMMARY` を指定する場合も `qa/weborca-readonly-preflight/summary.json` を指す path だけを受け付け、candidate discovery、acceptmodv2、fullflow、network、HAR/trace/video/screenshot artifact path は mutation 前に拒否する。`qa-weborca-candidate-discovery.mjs` の summary、local selectable、HTTP 200、not-run / not-verified result、または old RUN_ID の evidence は Phase 3 実行許可にしない。
- exact selected-candidate preflight summary は `source=qa-weborca-readonly-preflight`、`flowMode=exact-readonly-preflight`、`trialSourceCandidate` / `officialPatientExistence` / `insuranceReadiness` / `selectorReadiness` / `localSelectableReadiness` / `appointmentDependency` / `acceptmodv2ReadOnlyDiagnostic` を分離し、`acceptedForPhase3Attempt=true`、`phase3AttemptPatientId`、artifact path/hash/input identity が揃った run だけ `qa-acceptmodv2-weborca.mjs` へ渡す。official patient existence は `/api/orca/official/patientgetv2?id=<patientId>&format=json` の parsed ORCA body にある `Api_Result`、`Patient_Information`、完全一致 `Patient_ID` だけを証跡にし、`/api/orca/official/patients/batch` の DTO は exact preflight official patient evidence として扱わない。official `Patient_ID` は完全一致必須で、ゼロ埋め桁違いは一致扱いにしない。
- exact selected-candidate preflight は read-only 証跡です。`patientmodv2` create/update、appointments/visits mutation、acceptance operation、`medicalmodv2`、`diseasev3`、local billing send、temporary medical reconcile は browser route で abort し、request が記録された場合は `mutationPolicy.blockedRequestCount>0` / `readonly_mutation_attempt_blocked` として Phase 3 handoff を拒否する。blocked request evidence は route template、method、固定 reason に限定し、query、request body、患者 ID、保険 detail、credential、Cookie、Authorization、CSRF は summary に残さない。
- RWO-08B Fullflow 再試行前は `node scripts/qa-rwo08b-target-readiness.mjs --dry-run|--execute-readonly --sanitized-evidence-only --disable-browser-artifacts ...` で、candidate discovery、exact selected-candidate preflight、server-derived `/api/orca/official/visits/identifier-preflight` を 1 つの sanitized target-readiness summary にまとめる。`candidate_discovery_no_selected_candidate`、`local_exact_match_missing`、`identifier_preflight_not_run`、`identifier_preflight_target_blocked` はいずれも Fullflow retry blocker とし、`target_ready_for_diagnostic_fullflow` の場合も L4 success ではなく次の diagnostic Fullflow queue 証跡に限定する。`target_provisionally_ready_for_diagnostic_fullflow` は strict な voucher / sequential proof ではない。server-derived `acceptlstv2` target と `visitptlstv2` の一意な患者/日付/診療科/保険コンテキストが一致する場合だけ許容する provisional gate であり、summary の `strictIdentifierPreflightReady=false`、`provisionalIdentifierPreflightReady=true`、claim boundary、target-drift check を明示してから diagnostic Fullflow queue に進める。患者 ID 単独、client-provided identifier、UI 表示だけではこの provisional gate を満たさない。`--execute-readonly` では `--acceptance-date` と server-derived `--target-row-hash` を必須にし、raw ORCA body、患者・保険 detail、credential、HAR、trace、video、screenshot は保存しない。
- `medicalmodv2` の live fullflow は、GUI が渡す encounter context ではなく、server の `encounter_projection` と `worklist_flags.officialVisitIdentifiers` を authority として検証する。通常 UI の初回会計送信は Charts の `診察終了して会計へ送信` から `POST /api/local/encounters/{encounterKey}/close-and-send-to-billing` を呼び、server-side snapshot / transmission に `Medical_Uid` を保存する。Reception には標準初回 `会計送信` direct button を戻さない。WebORCA Trial direct acceptance で voucher / sequential が official response から得られない場合に限り、server が `acceptlstv2` の一意な患者/日付/診療科/保険コンテキストから `provisionalMedicalModV2Context=true` を保存した行を使える。voucher / sequential / insurance / `Medical_Uid` / `classCode` を client 側で改ざんした probe は ORCA transport 前に fail closed すること。
- close-and-send workflow の結果が `ORCA_UNKNOWN` の場合は、同じ snapshot を即再送しない。`tmedicalgetv2` で患者番号・診療日・入外・診療科の中途終了データを確認し、`Medical_Uid` / `Medical_Mode` / `Medical_Mode2` を記録してから recovery path へ進める。PushAPI / `pusheventgetv2` は補助情報であり、success evidence の正本にしない。
- exact selected-candidate preflight の `officialPatientExistence` / `officialPatientEvidence` は `httpStatus`、`parsedOrcaBody`、`apiResult`、`apiResultAccepted`、`patientInformationPresent`、`exactIdMatched`、`notFoundMessage`、`responseCategory`、`rejectionReason`、`evidenceHash`、`rawSensitiveFieldsExcluded=true` の allowlist フィールドだけを含める。00001〜00011 の rejected row は `officialPatientReadinessAxes.patientgetv2[]` に機械可読 failure dimensions として残すが、公式初期患者が存在しないとは結論しない。
- `insuranceReadiness` は HTTP 200 + parsed ORCA body + all-zero `apiResult` + 利用可能な `HealthInsurance_Information` / `Insurance_Combination_Number` evidence が揃った場合だけ accepted とする。patientlst6v2 の `apiResult=20` は `business_no_insurance_combination`、`apiResult=21` は `business_too_many_insurance_combinations` とし、E-prefixed / 91-like result は `request_contract_rejected`、その他 non-zero は `unknown_nonzero` として `business_rejected_insurance` にしない。HTTP 401/403/404/5xx、blank `apiResult`、wrapper error は `ambiguous_readiness_failure` とし、403 を `insurance_missing` と書かない。summary には count / effectiveCount / redacted selected combination id だけを残し、保険番号・記号番号・氏名等を出さない。`localSelectableReadiness` が official exact match と一致しない場合は `local_sync_required` の `test-data-blocker` として止める。
- `appointmentDependency` は HTTP 200 + parsed ORCA body + all-zero `apiResult` を基本 accepted 条件とし、`appointment_row` では exact appointment row evidence を必須とする。appointlst2v2 の `apiResult=21` は no appointment found として、`appointment_row` では `appointment_absent`、`direct_acceptance` では予約行 absence だけを blocker にしない。`apiResult=91` / E-prefixed result は `request_contract_rejected` とし、direct acceptance でも exact preflight を拒否する。
- `appointmentDependency` は `flowMode=direct_acceptance|appointment_row|unknown` を summary に残す。direct patient acceptance flow では `required=false` とし、予約行 absence だけを blocker にしない。`appointment_row` では exact appointment row evidence を必須とし、HTTP 401/403/404/5xx、blank `apiResult`、wrapper error は `ambiguous_readiness_failure` として、403 を `appointment_missing` と書かない。`acceptmodv2ReadOnlyDiagnostic` は `Request_Number=00` の read-only diagnostic として扱い、`apiResult=10` は `patient_not_found` rejection、`apiResult=60` は `no existing acceptance` diagnostic、`apiResult=00` with `Request_Number=00` は existing-acceptance diagnostic であって、いずれも mutation success ではない。
- medical-information が HTTP 200 / `apiResult=00`、patient search が selectable、department / physician / visit kind / payment mode / medical-information select が存在することを accepted 条件とする。
- `visitptlstv2` は HTTP 200 でも `apiResult=13` なら business success として扱わない。read-only preflight では rejected / not verified として記録し、mutation 成功の代替 evidence にしない。
- `acceptmodv2` は endpoint-specific semantics で判定する。HTTP 200、`Api_Result=00` / `0000`、または all-zero generic parser だけでは mutation success としない。
- `acceptmodv2` の business accepted 条件は、`Api_Result=00` / `0000` と `Acceptance_Info`、`Acceptance_Id`、`Patient_Information`、server-generated `encounterKey` / `scheduleKey` 等の受付登録証跡が同じ response に存在すること。証跡がなければ `notVerified` として停止する。
- `acceptmodv2` の `Api_Result=K1/K2/K3` は official warning code として扱うが、受付登録証跡がある場合だけ `businessAcceptedWithWarnings` とする。`Api_Result_Message` だけ、または warning message だけでは accepted にしない。
- `acceptmodv2` の `Api_Result=10` は `businessRejected` / `patient_not_found`、`Api_Result=60` は `diagnosticNoExistingAcceptance` / `no_existing_acceptance`、`Api_Result=00` with `Request_Number=00` は existing-acceptance diagnostic とし、いずれも単独で mutation success の証跡にしない。
- `qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` の patient picker は current reception workflow に合わせて `/api/local/patients/search` を使う。固定 seed を正本とみなさず、実行直前に current facility で local search 可能かつ単一 active entry を作れる患者IDを確認して `QA_PATIENT_ID` に渡す。
- `qa-acceptmodv2-weborca.mjs` は既定で同じ `RUN_ID` の exact selected-candidate `qa/weborca-readonly-preflight/summary.json` を要求する。preflight artifact を別パスに置いた場合は `QA_READONLY_PREFLIGHT_SUMMARY` を渡すが、path は `qa/weborca-readonly-preflight/summary.json` で終わる exact preflight summary に限定する。preflight accepted でない run、discovery proposal しかない run、または candidate discovery / acceptmodv2 / fullflow / network / raw browser artifact path では mutation を実行しない。
- `qa-fullflow-weborca.mjs` は Phase 3 が business accepted になった後だけ実行する。
- WO-8 後の Phase 4 endpoint-level `medicalmodv2` Trial 検証は、fullflow ではなく `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` を使う。live 実行では `--execute-approved-phase4 --sanitized-evidence-only --disable-browser-artifacts --phase4-only --workflow <prescription|treatment-generic> --payload <approved-json> --payload-sha256 <approved-sha256>` を必須にし、payload 内容や raw ORCA request/response body は保存しない。business success は HTTP 200 / zero-like `apiResult` だけでなく、sanitized summary の `response.businessAccepted=true` と information timestamp / `medicalUid` / `invoiceNumber` / `dataId` のいずれかの completion evidence で判定する。RUN_ID `20260423T150257Z` で `apiResult=14` 調査により stale `departmentCode=11` / `physicianCode=0005` payload を supersede し、prior sanitized Phase3 Trial context の `departmentCode=01` / `physicianCode=10001` を no-live wrapper gate で固定した。RUN_ID `20260424T031608Z` で prescription と treatment-generic の endpoint-specific v2 identities が L3 business accepted になったため、同じ duplicate-live checkpoint key を再実行しない。必要な local runtime config を非表示経路で供給し、backend を documented ORCA Trial config で起動確認してから 1 identity につき 1 回だけ実行する。
- 旧 closeout evidence の patientId や old RUN_ID を受入れ候補へ流用しない。current RUN_ID の rerun で local search 可否と active entry 解決性を取り直すこと。
- patient search が 0 件、または accept 後に canonical handoff 用の active entry を一意に解決できない場合は `test-data-blocker` として停止し、summary / network / console / page-errors を保存する。
- `qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` は `QA_MEDICAL_INFORMATION` 未指定時に `medicalInformation` を browser request body へ送らず、含まれた場合は script 自身が failure で停止する。指定時だけ current select option を送る。
- WebORCA Trial で `Acceptance_Push` workaround が必要な環境では、client 側ではなく server runtime config `ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH=true` を明示する。`setup-modernized-env.sh` の dev 起動はこの flag を既定で有効化する。
- artifact が `RUN_ID` 単位でまとまり、accept / fullflow / runtime-ready smoke の結果を同じ受入れ束へ添付できる。official `Voucher_Number` / `Sequential_Number` が不足する場合は fail-close のまま `official-visit-row-blocker` または `test-data-blocker` として summary / steps / network へ残す。
- fullflow では send 到達の有無にかかわらず `request-xml/medicalmodv2.xml`、HAR、raw network dump、raw request/response body を reviewer packet 正本へ含めない。診断 harness がそれらを local-only / untracked に生成した場合でも、third party が再読する証跡は `summary.json`、`blocker-summary.json`、`handoff-state.json`、`selected-visit-row.json`、allowlisted completion/status fields、hash、diagnostic artifact manifest に限定する。
- C7 dynamic evidence は target mutation request capture が存在する場合だけ verified とする。`targetMutationRequestCount=0` / `checkedRequests=0` の summary は accepted にしない。
- MSW/local/static tests は live ORCA fullflow success と混ぜない。MSW mock/test-only legacy route surface、local smoke、static helper tests は live ORCA mutation / fullflow の代替証跡ではない。

### ORCA billing/report live profile
会計・帳票の live Trial 検証は、同一 RUN_ID の runtime-ready smoke、candidate discovery、exact selected-candidate preflight、accept/fullflow の後続 profile として実行する。患者 ID 単独、UI 表示値、client-provided voucher / sequential / insurance combination / invoice number / `Data_Id` / storage key / digest は受入れ根拠にしない。

事前 dry-run:
```bash
cd web-client && RUN_ID=<RUN_ID> node scripts/qa-orca-billing-report-live-profile.mjs \
  --dry-run --sanitized-evidence-only --disable-browser-artifacts \
  --candidate-discovery-summary ../artifacts/orca-remediation/closeout/<RUN_ID>/qa/weborca-candidate-discovery/summary.json \
  --exact-preflight-summary ../artifacts/orca-remediation/closeout/<RUN_ID>/qa/weborca-readonly-preflight/summary.json
```

manual live handoff:
```bash
cd web-client && RUN_ID=<RUN_ID> node scripts/qa-orca-billing-report-live-handoff.mjs \
  --sanitized-evidence-only --disable-browser-artifacts --require-manual-approval \
  --dry-run-summary ../artifacts/orca-remediation/closeout/<RUN_ID>/qa/billing-report-live-profile/summary.sanitized.json \
  --approval-reference <approval-record-id> \
  --report-types invoicereceipt
```

operator result record:
```bash
cd web-client && node scripts/qa-orca-billing-report-live-result.mjs --print-operator-result-template \
  > ../artifacts/orca-remediation/closeout/<RUN_ID>/qa/billing-report-live-result/operator-result.template.json

cd web-client && RUN_ID=<RUN_ID> node scripts/qa-orca-billing-report-live-result.mjs \
  --sanitized-evidence-only --disable-browser-artifacts \
  --handoff-summary ../artifacts/orca-remediation/closeout/<RUN_ID>/qa/billing-report-live-handoff/handoff.sanitized.json \
  --operator-result-summary <operator-result.sanitized.json>
```

受入れ条件:
- `income-info` は server-side facility と exact selected-candidate preflight で確認済みの患者・診療日だけを対象にし、結果は `orca_billing_cache` の `source_system=ORCA`、request/response hash、件数、sanitized summary で確認する。
- `/api/orca/official/reports/{type}` は `orca_report_snapshot` の request/response hash、invoice/data id hash、server-generated storage key/digest、`storageUploadStatus`、`reportBinaryAvailable` だけを evidence にする。
- object storage 有効時の帳票 binary は `OrcaReportBinaryStorageService` の digest verification を通過した場合だけ accepted とし、upload 失敗は fail-closed blocker とする。
- live handoff は ready な dry-run summary と manual approval reference の hash だけを evidence にし、handoff command 自体は live ORCA traffic を実行しない。`--live`、HAR、trace、video、screenshot、raw network、raw patient / invoice / `Data_Id` / `Medical_Uid` / storage key / digest を渡す flag または環境変数が有効な場合は実行前に fail する。
- operator result record は handoff summary と operator の sanitized result JSON だけを入力にする。`operatorOutcome=live_success_sanitized` を accepted evidence にするには `source_system=ORCA`、request/response hash、row count、invoice/data id hash、server-generated storage key/digest presence、`storageUploadStatus`、`reportBinaryAvailable` が揃い、raw patient / raw invoice / raw `Data_Id` / raw `Medical_Uid` / storage key/digest / HAR / trace / video / screenshot / raw network を含まないことを wrapper が確認する。
- operator result JSON は `--print-operator-result-template` の出力を元に作る。template は dummy sha256 と allowlist field だけを含む no-write sample であり、operator は raw ORCA body、帳票本文、raw patient / invoice / `Data_Id` / `Medical_Uid`、storage key/digest、credential、HAR、trace、video、screenshot、raw network を追記してはならない。
- reviewer submission packet に含める billing/report profile evidence は `qa/billing-report-live-profile/summary.sanitized.json` の dry-run sanitized summary だけとし、`liveTrialOrca.executed=false` を保持する。これは live Trial 実行成功、会計済み、収納済み、レセプト正本化の証跡ではなく、次の live 実行可否を判定する gate evidence に限定する。
- reviewer submission packet に含める billing/report result evidence は `qa/billing-report-live-result/result.sanitized.json` の operator sanitized result record だけとする。packet validation は ready handoff hash、`rawSensitiveFieldsExcluded=true`、ORCA由来 income cache / report snapshot の hash-only evidence、server-generated storage key/digest presence、upload failure / expired / blocker なしを要求し、raw ORCA body、raw patient / invoice / `Data_Id` / `Medical_Uid`、帳票本文、storage key/digest、HAR、trace、video、screenshot、raw network を拒否する。
- 証跡に raw ORCA body、帳票本文、raw invoice number、raw `Data_Id`、raw `Medical_Uid`、患者氏名・住所・電話番号、保険詳細、credential、Cookie、Authorization、HAR、trace、video、screenshot、raw network JSON を残さない。
- `storageUploadStatus=UPLOADED` だけでは会計済み・収納済み・レセプト正本化を意味しない。ORCA由来 snapshot/cache の取得証跡に限定する。

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
- packet にコピーされた report / QA / evidence には raw XML、stacktrace、HAR、request XML、raw network dump 参照が残らない。
- packet にコピーされた report / QA / evidence には `error-context.md`、trace zip、video、screenshot、raw body / raw JSON / raw text 参照も残らない。
- `scripts/create-review-archive.sh` は reviewer 提出用の正本ではなく、受入れ手順に含めない。
- evidence freeze 後に accepted branch が別 commit を指した場合は、`--accepted-head <ACCEPTED_HEAD>` を付けて packet HEAD を固定する。

## Worker G の post-merge 確認
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test
cd web-client && node scripts/verify-no-blocked-orca-route-strings.mjs
```

- Integrator G merge batch `20260511T035538Z` advanced the Flyway integration order through `V0329`; future branch integration must allocate migration numbers after `V0329` unless this batch is superseded.
- `PublicRouteInventoryContractTest` で official / master / local / admin-internal inventory が current taxonomy と一致することを確認する。
- `WebXmlEndpointExposureTest` で `/api/*` exposure と `/api/orca/*` taxonomy が崩れていないことを確認する。
- `verify-no-blocked-orca-route-strings.mjs` で repo-wide scanned roots の taxonomy drift や blocked mock surface が残っていないことを確認する。
- `/api/orca/queue` と `/api/orca/pusheventgetv2` は production fail-close sentinel、MSW mock/test-only legacy route surface、e2e/QA fixture surface、blocked-route detector、docs/reference、server route inventory negative assertion、web.xml exposure negative assertion の分類済み retained string / negative assertion として扱い、guard success message も category counts で同じ分類を示すことを確認する。
- 上記 allowlist category は retained string / negative assertion の説明であり、public route として受け入れない。official/master 以外の `/api/orca/*` を新しい public route として追加した場合は release を止める。
- Reception / Patients / Charts / Admin の UI と server contract が taxonomy contract と一致していることを確認する。
- web-client と server-modernized を別々の remediation wave で混在 deploy しない。pair release で同時に切り替える。

## 補助コマンド
```bash
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-audit-append-only.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-backup-restore-runbook.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-production-operations-runbook.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-live-orca-trial-harness.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
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
- `runtime-ready-smoke` の artifact scan は `*.png` / `*.har` / trace / video / raw network dump の 0 hit を返す。
- `qa-weborca-candidate-discovery.mjs` が Trial native mutation-ready candidate を 1 件以上 accepted にした場合でも、その summary は selected-candidate proposal に留める。同一 RUN_ID / candidate の `qa-weborca-readonly-preflight.mjs` exact selected-candidate preflight が `source=qa-weborca-readonly-preflight`、`flowMode=exact-readonly-preflight`、`acceptedForPhase3Attempt=true`、artifact path/hash/input identity 一致を満たした後、別タスクで `qa-acceptmodv2-weborca.mjs` を実行できる。`qa-fullflow-weborca.mjs` は Phase 3 business accepted 後に実行し、`medicalInformation` 未選択時は browser request body 未送信の証跡を残す。未指定 run で request body に `medicalInformation` が含まれた場合は fail と判定される。
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
- 最低限 `git/git-head-current.txt`、`git/git-branch-current.txt`、`reports/final-report.md`、`qa/acceptmodv2/accept-summary.sanitized.json`、`qa/fullflow/summary.sanitized.json`、`qa/fullflow/steps.log`、`qa/fullflow/console.sanitized.json`、`qa/fullflow/page-errors.sanitized.json` を同一 RUN_ID へ揃える。legacy harness が `qa/fullflow/network/network.json`、`qa/fullflow/network/requests.json`、screenshot、HAR、trace、video、request XML、raw request/response body、raw network dump を生成または要求する場合、その実行は owner-approved diagnostic fullflow として local-only / untracked に隔離し、release evidence には sanitized extracted summary と diagnostic artifact manifest だけを使う。
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
- [ ] `mode=off` / `mode=permissive` / keyring 欠落は起動 validation で fail closed になる。

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
- `full_source_secret_scan_claim=not_claimed` は full clean ではない。`worktree_clean=not_verified` は clean checkout truth ではない。
- packet 生成は repo root から実行し、`review-checkout/` と `closeout-packet/` を分離同梱する。
- `closeout-packet/` の required file が欠けていたら fail する。欠落を別 zip や old RUN_ID で補わない。
- packet 生成後は `./scripts/validate-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <ACCEPTED_BRANCH>` を必ず通す。branch drift がある場合は create/validate の両方へ `--accepted-head <ACCEPTED_HEAD>` を付ける。
- reviewer が辿る path は packet-relative に統一し、絶対ローカルパスを残さない。
- reviewer submission packet に live evidence を含める場合は、closeout evidence から reviewer が再読するための sanitized extracted subset だけを同梱する。candidate discovery / preflight / accept / fullflow の raw network、request XML、response XML、server stacktrace から credential-bearing URL、Cookie、Authorization、JSESSIONID、CSRF、raw password、氏名・住所・電話番号・保険記号番号などの患者機微 detail を除外し、sanitized summary、redacted selected id、hash、classification、artifact-relative path に限定する。抽出 subset は exact selected-candidate preflight handoff の存在確認には使えるが、raw live success や Phase 3 実行許可を新たに推定する材料にしない。

## 補足
- `check-no-generated-artifacts.sh` は tracked / untracked の両方を検査する。
- `check-sensitive-evidence-redaction.sh` は review-target の browser bundle / test-results / Playwright output / test snapshots を検査し、historical `artifacts/` 全体を release evidence として扱わない。reviewer packet に入れる証跡は reviewer-submission packet tool の allowlist 済み sanitized subset に限定する。
- `check-backup-restore-runbook.sh` は backup / restore / hash verification runbook、release gate、outage recovery、audit contract が同じ restore fail-closed 境界を参照していることを検査する。
- `check-production-operations-runbook.sh` は production operations readiness runbook、release validation、cutover、outage recovery、backup/restore、reviewer packet が同じ pair release / secret store / sanitized evidence / rollback stop condition を参照していることを検査する。
- `check-live-orca-trial-harness.sh` は live ORCA Trial checklist harness と release validation が sanitized evidence / browser artifact disable / exact preflight before mutation の境界を維持していることを検査する。
- `check-no-direct-runtime-lookup.sh` は `ServerConfigurationResolver.java` 以外の direct runtime lookup を許可しない。
- どれか 1 つでも失敗したら release は見送る。
- cutover / rollback の実施順序と停止条件は [../releases/orca-remediation-cutover.md](../releases/orca-remediation-cutover.md) を正本とする。
