# ORCA Remediation Cutover

最終更新: 2026-04-14  
用途: Worker G の post-merge verification 後に、ORCA remediation 一式を本番相当へ切り替えるための cutover / rollback 正本

## 1. 前提
- `master` に Worker G の最終修正が入っていること。
- `docs/runbooks/release-validation.md` の必須コマンドが成功していること。
- closeout 判定に使う証跡が `artifacts/orca-remediation/closeout/<RUN_ID>/` にまとまっていること。
- ORCA 接続確認を別 run で取った場合は `artifacts/orca-connectivity/<RUN_ID>/` を closeout report から参照できること。
- runtime smoke / accept / fullflow の summary, network, console, page-errors が closeout bundle 配下にあること。
- route taxonomy の前提は `official=/api/orca/official/*`、`master=/api/orca/master/*`、`local=/api/local/*`、`admin-internal=/api/admin/internal/*` で固定し、official/master/local を混在 deploy しないこと。
- `/api/orca/*` の public route は official/master のみ。production fail-close sentinel、MSW mock/test-only legacy route surface、e2e/QA fixture surface、blocked-route detector、docs/reference、server route inventory negative assertion、web.xml exposure negative assertion は retained string / negative assertion category であり、public route ではない。
- cutover は `web-client` と `server-modernized` の remediation pair release を前提とする。片側だけ先に切り替える運用は current contract 外とする。

## 2. 事前チェック
- `PublicRouteInventoryContractTest` / `WebXmlEndpointExposureTest` / `verify-no-blocked-orca-route-strings.mjs` が current taxonomy を保持している。
- `PatientsPage` と chart patient edit が official `patientmodv2` update を使う。
- `acceptmodv2` の endpoint-specific business semantics が UI / parser / QA script / server test で揃っている。HTTP 200 や all-zero generic parser だけを mutation success とせず、`Api_Result=00/0000` は受付登録証跡ありの場合だけ `businessAccepted`、`Api_Result=K1/K2/K3` は受付登録証跡ありの場合だけ `businessAcceptedWithWarnings` とする。
- `acceptmodv2` の `Api_Result=10` は `businessRejected` / `patient_not_found`、`Api_Result=21` は `businessRejected` / `insurance_mismatch`、`Api_Result=60` は `diagnosticNoExistingAcceptance` / `no_existing_acceptance`、`Api_Result=00` with `Request_Number=00` は existing-acceptance diagnostic として扱い、単独では mutation success の証跡にしない。read-only insurance readiness でも `apiResult=21/23` は `business_rejected_insurance` とし、HTTP 401/403/404/5xx、blank `apiResult`、wrapper error は `ambiguous_readiness_failure` として `insurance_missing` と混同しない。
- `patientlst3v2` request / response が official 契約に沿っている。
- `manageusersv2` create/update XML が official 契約に沿っている。
- `contraindicationcheckv2` と `incomeinfv2` が UI / server contract / test で揃っている。
- `medicationgetv2` は 01/02 契約で drift がなく、診療日未解決時に fail-close する。

## 3. 実施順序
1. `docs/runbooks/release-validation.md` の grep と targeted tests を完了する。
2. `cd web-client && npm run ci`
3. `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
4. `cd web-client && node scripts/runtime-ready-smoke.mjs`
5. `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`
6. `curl -sk https://127.0.0.1:8443/openDolphin/api/orca/official/appointments/medical-information` で `system01lstv2 Request_Number=06` 相当の direct probe を先に取り、同じ `RUN_ID` 配下へ evidence 化する。
7. ORCA Trial または承認済み接続先で、まず `cd web-client && node scripts/qa-weborca-candidate-discovery.mjs` を read-only で実行する。既定候補は WebORCA Trial 公式初期患者 `00001`〜`00011` とし、これらは official initial data として存在するが current evidence では mutation-ready とは限らない。旧 local smoke seed `0000001` は rejected candidate として扱い、Trial native candidate / mutation-ready candidate として採用しない。discovery summary は sanitized selected-candidate proposal であり、Phase 3 handoff artifact ではない。accepted candidate が 0 件の場合も、公式初期患者が存在しないとは結論しない。verdict は `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` とし、意味は current harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria により mutation-ready read-only evidence が未充足であることに限定する。
8. discovery で選んだ同一 RUN_ID / selected candidate に対して `cd web-client && QA_PATIENT_ID=<discovery.selectedCandidatePatientId> node scripts/qa-weborca-readonly-preflight.mjs` を実行する。この exact selected-candidate preflight だけが Phase 3 handoff artifact であり、`source=qa-weborca-readonly-preflight`、`flowMode=exact-readonly-preflight`、`acceptedForPhase3Attempt=true`、`phase3AttemptPatientId`、artifact path/hash/input identity が揃うことを必須とする。preflight は read-only 限定で `trialSourceCandidate` / `officialPatientExistence` / `insuranceReadiness` / `selectorReadiness` / `localSelectableReadiness` / `appointmentDependency` / `acceptmodv2ReadOnlyDiagnostic` を分離し、official `Patient_ID` 完全一致、保険 count/effective、local exact selectable、selector、Request_Number=00 diagnostic を fail-close で評価する。insurance は HTTP 200 + all-zero `apiResult` + 利用可能な evidence のみ accepted、appointment は `flowMode=direct_acceptance|appointment_row|unknown` を分けて `appointment_row` だけ exact row evidence 必須とする。
9. exact selected-candidate preflight summary の `acceptedForPhase3Attempt=true` と `phase3AttemptPatientId` が同一 RUN_ID で揃った後だけ、`cd web-client && QA_PATIENT_ID=<readonly-preflight.phase3AttemptPatientId> node scripts/qa-acceptmodv2-weborca.mjs` を実行する。固定 seed、discovery-only summary、local selectable のみ、HTTP 200 のみ、not-run / not-verified result、old RUN_ID evidence を Phase 3 許可にしない。current facility の local search と active entry 状態を確認し、patient search 0 件、重複受付、active entry 非一意、live mutation `businessRejected` / `diagnosticNoExistingAcceptance` / `notVerified` のいずれかが見つかったら停止し、summary / network / console / page-errors を残す。
10. Phase 3 business accepted 後だけ、同じ環境・同じ `RUN_ID`・同じ `QA_PATIENT_ID` で `cd web-client && QA_PATIENT_ID=<accepted candidate patientId> node scripts/qa-fullflow-weborca.mjs` を実行する。
11. reception / charts / patients / admin の手動 smoke を実行する。
12. current `RUN_ID` の closeout report を完成させ、reviewer submission packet を生成・検証する。
```bash
./scripts/create-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <ACCEPTED_BRANCH>
./scripts/validate-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <ACCEPTED_BRANCH>
```
- accepted branch が evidence freeze 後に進んでいた場合は、両コマンドへ `--accepted-head <ACCEPTED_HEAD>` を追加して packet provenance を固定する。

## 4. Smoke 観点
- Reception:
  - 既存患者検索が current reception workflow どおり `/api/local/patients/search` で通る。
  - `既存患者受付/患者検索` モーダルから患者検索結果を選択し、`受付する` が current 導線で機能する。
  - `Api_Result=00/0000` は `Acceptance_Info`、`Acceptance_Id`、`Patient_Information`、server-generated `encounterKey` / `scheduleKey` 等の受付登録証跡が同じ response にある場合だけ accepted として扱われる。
  - `Api_Result=K1/K2/K3` は official warning code として扱うが、受付登録証跡がある場合だけ accepted with warnings とする。message だけでは accepted にしない。
  - `Api_Result=10` は `patient_not_found` rejection、`Api_Result=21` は保険不一致、`Api_Result=60` は受付なし診断、`Api_Result=00` with `Request_Number=00` は既存受付診断として表示され、いずれも単独で mutation success として一覧・handoff に反映しない。
  - `visits/mutation` browser payload の `medicalInformation` は UI 選択時のみ送信し、未選択なら field 自体を送信しない。
- Charts:
  - chart send/finish の official outbound が `medicalmodv2` と `incomeinfv2` に限定される。
  - `incomeinfv2` request は official sample 準拠の `patientId + baseDate` で送信し、`Request_Number` や独自 root/tag を混在させない。
  - `contraindicationcheckv2` が UI から呼ばれる。
  - `medicationgetv2` は 9 桁コード + 開始日ありの時だけ候補取得し、診療日未解決では fail-close する。
- Patients:
  - official create / update / import が分離され、成功後に canonical re-fetch + local sync される。
  - chart patient edit が Patients と同じ official update route を使う。
- Admin:
  - `manageusersv2` list / create / update / delete が current XML 契約どおり送信される。
  - ORCA ユーザ更新画面で `User_Id` / `職員区分` / `職員番号` / `管理者権限` が更新不可として表示され、UI 文言が XML 契約と矛盾しない。
  - 接続設定では「管理画面権限確認」と「ORCA 接続テスト成功」が分離表示され、`pushTenantId` 単独保存が UI / server の両方で拒否される。
  - 診断セクションに official/local 境界を曖昧にする「一括疎通（グループ）」表現が残っていない。

## 5. Smoke artifact
- `qa-acceptmodv2-weborca.mjs` は current 受付導線のスクリーンショット、network、summary を残す。
- `qa-weborca-candidate-discovery.mjs` は Trial data を current `RUN_ID` evidence として扱い、candidate rows / summary / network / console / page-errors を `qa/weborca-candidate-discovery/` に残す。ORCA Trial 公式初期患者 `00001`〜`00011` は official initial data として存在するが、official 初期患者情報は category / count 程度に sanitized し、raw sensitive detail は artifact summary に残さない。`acceptedForPhase3Attempt` の最初の 1 件があっても discovery summary は selected-candidate proposal に留め、Phase 3 handoff artifact にはしない。accepted candidate が 0 件の場合も公式初期患者不在とは書かず、`PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` として harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria の未充足を示す。
- `qa-weborca-readonly-preflight.mjs` は Phase 3 前提を mutation なしで確認する exact selected-candidate preflight としてだけ扱い、`source=qa-weborca-readonly-preflight`、`flowMode=exact-readonly-preflight`、`trialSourceCandidate` / `officialPatientExistence` / `insuranceReadiness` / `selectorReadiness` / `localSelectableReadiness` / `appointmentDependency` / `acceptmodv2ReadOnlyDiagnostic` を summary に残す。official `Patient_ID` は完全一致必須、`0000001` は rejected candidate、local-only / official mismatch は `local_sync_required`、appointment absence は direct flow なら blocker にしない。`appointment_row` flow では exact appointment row evidence が必須で、appointment HTTP 403 は `appointment_missing` ではなく `ambiguous_readiness_failure` とする。insurance HTTP 403 も `insurance_missing` ではなく `ambiguous_readiness_failure` とする。`apiResult=10` diagnostic は `patient_not_found` rejection、`apiResult=60` は no existing acceptance diagnostic、`apiResult=00` with `Request_Number=00` は existing-acceptance diagnostic であり mutation success ではない。preflight accepted でない場合、または discovery proposal しかない場合、`qa-acceptmodv2-weborca.mjs` は実行しない。
- `qa-fullflow-weborca.mjs` は reception -> charts -> claim/income/support の一連の network とスクリーンショットを残す。
- `appointments/medical-information` の direct probe を同じ `RUN_ID` の network evidence に残し、`system01lstv2` 側の成功/失敗を smoke 本体と分離して再読できるようにする。
- patient search が 0 件なら `QA_PATIENT_ID` の不足/不一致として扱い、local seed 不一致のまま「UI 不具合」と誤判定しない。
- `runtime-ready-smoke` が smoke seed 不一致で失敗した場合は、`tests/runtime-ready-smoke.log` を current `RUN_ID` へ保存し、`test-data-blocker` または `environment-blocker` として分類する。repo defect と断定したまま cutover 判断を進めない。
- `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` は Vite PID だけで成功扱いしない。`https://localhost:5173/` の実応答と dev server process 生存を確認し、失敗時は actionable error として setup log に残す。
- local smoke seed は `encounterKey=1.3.6.1.4.1.9414.72.103:SMOKE-20251129-0001`、`scheduleKey=SMOKE-SCHEDULE-20251129-0001`、`DEV_SMOKE_PATIENT_ID=0000001`、Asia/Tokyo 当日 09:00 を既定とし、schedule / encounter projection が同じ患者を指すことを確認する。
- `runtime-ready-smoke` は `/api/orca/queue` と `/api/orca/pusheventgetv2` を blocked legacy route hit として扱い、browser request が出た場合は failure にする。この detector は success route ではなく、旧 route が使われていないことを検知するための gate である。
- `QA_MEDICAL_INFORMATION` を指定しない run を 1 本含め、未選択時に browser request body の `medicalInformation` が未送信であることを証跡化する。未指定 run で request body に `medicalInformation` が含まれた場合は script failure として cutover を止める。
- `Acceptance_Push` suppress が必要な環境では server runtime config で明示し、client 側の補完/抑止に戻さない。
- ORCA send に到達した run だけ `qa/fullflow/request-xml/medicalmodv2.xml` を必須とする。未到達 run は `summary.json` の blocker classification と `steps.log` / `network/*.json` で停止理由を third party が追えることを条件とする。official `Voucher_Number` / `Sequential_Number` が不足した場合は fail-close のまま `official-visit-row-blocker` として残す。
- C7 dynamic evidence は target mutation request capture が存在する場合だけ verified とする。`targetMutationRequestCount=0` / `checkedRequests=0` は accepted にしない。
- MSW/local/static tests は live ORCA fullflow success と混ぜない。MSW mock/test-only route surface、local smoke、static helper tests は live mutation / fullflow の代替証跡ではない。
- reviewer submission packet では `review-checkout/` と `closeout-packet/` を分離し、`manifest.json`、`manifest.sha256`、`README_REVIEW.md` を同梱する。absolute local path を含む report / manifest / evidence は受入れ不可とする。
- reviewer submission packet に live evidence を含める場合は、closeout evidence から extracted subset だけを同梱する。candidate discovery / preflight / accept / fullflow の raw network から credential-bearing URL、Cookie、Authorization、JSESSIONID、CSRF、raw password、氏名・住所・電話番号・保険記号番号などの患者機微 detail を除外し、sanitized summary、redacted selected id、hash、classification、artifact-relative path へ限定する。抽出 subset は exact selected-candidate preflight handoff の検証材料であり、HTTP 200 や discovery-only accepted を live success と推定する材料にしない。
- `create-review-package.sh` の support zip は `.git/` を含まないため、clean checkout truth として扱わない。clean truth は reviewer submission packet の `review-checkout/` でだけ判定する。
- `full_source_secret_scan_claim=not_claimed` は full clean ではない。`worktree_clean=not_verified` は clean checkout truth ではない。
- accepted branch drift が起きても、packet の accepted HEAD は current closeout evidence の `git/git-head-current.txt` と一致させる。

## 6. 成功判定
- 上記コマンドと smoke が成功し、artifact が同じ RUN_ID に束ねられている。
- reviewer submission packet の create / validate が成功している。
- route / DTO / docs / tests のどれにも旧 route / 旧 schema / 旧文言が残っていない。
- release owner が GO 判定できるだけの証跡が揃っている。

## 7. Rollback 条件
- `npm run ci`、`mvn ... verify`、runtime smoke のいずれかが失敗した。
- `qa-acceptmodv2-weborca.mjs` または `qa-fullflow-weborca.mjs` が current UI 導線で失敗した。
- ORCA 接続確認で allowlist 外接続、権限逸脱、旧 route 再混入が見つかった。
- Reception / Charts / Patients / Admin の smoke で official 契約に反する挙動が出た。

## 8. Rollback 手順
1. 新しい deploy / 切替を停止する。
2. 直前の安定コミットまたは release artifact に戻す。
3. `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` で戻し先を再起動する。
4. Reception の検索 / 受付、Charts の閲覧、Patients の一覧、Admin の接続確認だけを最小 smoke で再確認する。
5. rollback 後の証跡を同じ RUN_ID 配下に `rollback` として残す。
6. pair release を崩したままの片側 rollback を行わない。戻す場合は `web-client` と `server-modernized` を同じ組で戻す。

## 9. 再実行条件
- root cause を code / test / docs に反映済みであること。
- rollback 後の最小 smoke が成功していること。
- 新しい RUN_ID を採番し、cutover を 2. からやり直すこと。
