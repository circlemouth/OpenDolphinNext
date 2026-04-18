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
- cutover は `web-client` と `server-modernized` の remediation pair release を前提とする。片側だけ先に切り替える運用は current contract 外とする。

## 2. 事前チェック
- `PublicRouteInventoryContractTest` / `WebXmlEndpointExposureTest` / `verify-no-blocked-orca-route-strings.mjs` が current taxonomy を保持している。
- `PatientsPage` と chart patient edit が official `patientmodv2` update を使う。
- `acceptmodv2` の `Api_Result=21/60` が UI / server test で揃っている。
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
7. ORCA Trial または承認済み接続先で、`cd web-client && QA_PATIENT_ID=<local searchable patientId> node scripts/qa-weborca-readonly-preflight.mjs` を実行する。mutation は行わず、medical-information HTTP 200 / `apiResult=00`、patient search selectable、department / physician / visit kind / payment mode / medical-information select の存在を確認する。`visitptlstv2` は HTTP 200 でも `apiResult=13` なら business success として扱わない。
8. read-only preflight accepted 後だけ、`cd web-client && QA_PATIENT_ID=<local searchable patientId> node scripts/qa-acceptmodv2-weborca.mjs` を実行する。固定 seed を前提にせず、実行直前に current facility の local search と active entry 状態を確認する。patient search 0 件、重複受付、active entry 非一意、live mutation business reject のいずれかが見つかったら `test-data-blocker` として停止し、summary / network / console / page-errors を残す。
9. Phase 3 business accepted 後だけ、同じ環境・同じ `RUN_ID`・同じ `QA_PATIENT_ID` で `cd web-client && QA_PATIENT_ID=<local searchable patientId> node scripts/qa-fullflow-weborca.mjs` を実行する。
10. reception / charts / patients / admin の手動 smoke を実行する。
11. current `RUN_ID` の closeout report を完成させ、reviewer submission packet を生成・検証する。
```bash
./scripts/create-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <ACCEPTED_BRANCH>
./scripts/validate-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <ACCEPTED_BRANCH>
```
- accepted branch が evidence freeze 後に進んでいた場合は、両コマンドへ `--accepted-head <ACCEPTED_HEAD>` を追加して packet provenance を固定する。

## 4. Smoke 観点
- Reception:
  - 既存患者検索が current reception workflow どおり `/api/local/patients/search` で通る。
  - `既存患者受付/患者検索` モーダルから患者検索結果を選択し、`受付する` が current 導線で機能する。
  - `Api_Result=21` は保険不一致、`Api_Result=60` は受付なしとして表示される。
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
- `qa-weborca-readonly-preflight.mjs` は Phase 3 前提を mutation なしで確認し、accepted / rejected / not verified と blocker classification を summary に残す。preflight accepted でない場合、`qa-acceptmodv2-weborca.mjs` は実行しない。
- `qa-fullflow-weborca.mjs` は reception -> charts -> claim/income/support の一連の network とスクリーンショットを残す。
- `appointments/medical-information` の direct probe を同じ `RUN_ID` の network evidence に残し、`system01lstv2` 側の成功/失敗を smoke 本体と分離して再読できるようにする。
- patient search が 0 件なら `QA_PATIENT_ID` の不足/不一致として扱い、local seed 不一致のまま「UI 不具合」と誤判定しない。
- `runtime-ready-smoke` が smoke seed 不一致で失敗した場合は、`tests/runtime-ready-smoke.log` を current `RUN_ID` へ保存し、`test-data-blocker` または `environment-blocker` として分類する。repo defect と断定したまま cutover 判断を進めない。
- `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` は Vite PID だけで成功扱いしない。`https://localhost:5173/` の実応答と dev server process 生存を確認し、失敗時は actionable error として setup log に残す。
- local smoke seed は `encounterKey=1.3.6.1.4.1.9414.72.103:SMOKE-20251129-0001`、`scheduleKey=SMOKE-SCHEDULE-20251129-0001`、`DEV_SMOKE_PATIENT_ID=0000001`、Asia/Tokyo 当日 09:00 を既定とし、schedule / encounter projection が同じ患者を指すことを確認する。
- `runtime-ready-smoke` は `/api/orca/queue` と `/api/orca/pusheventgetv2` を blocked legacy route hit として扱い、browser request が出た場合は failure にする。
- `QA_MEDICAL_INFORMATION` を指定しない run を 1 本含め、未選択時に browser request body の `medicalInformation` が未送信であることを証跡化する。未指定 run で request body に `medicalInformation` が含まれた場合は script failure として cutover を止める。
- `Acceptance_Push` suppress が必要な環境では server runtime config で明示し、client 側の補完/抑止に戻さない。
- ORCA send に到達した run だけ `qa/fullflow/request-xml/medicalmodv2.xml` を必須とする。未到達 run は `summary.json` の blocker classification と `steps.log` / `network/*.json` で停止理由を third party が追えることを条件とする。official `Voucher_Number` / `Sequential_Number` が不足した場合は fail-close のまま `official-visit-row-blocker` として残す。
- reviewer submission packet では `review-checkout/` と `closeout-packet/` を分離し、`manifest.json`、`manifest.sha256`、`README_REVIEW.md` を同梱する。absolute local path を含む report / manifest / evidence は受入れ不可とする。
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
