# ORCA Remediation Cutover

最終更新: 2026-04-12  
用途: Worker G の post-merge verification 後に、ORCA remediation 一式を本番相当へ切り替えるための cutover / rollback 正本

## 1. 前提
- `master` に Worker G の最終修正が入っていること。
- `docs/runbooks/release-validation.md` の必須コマンドが成功していること。
- ORCA 接続確認の証跡が `artifacts/orca-connectivity/<RUN_ID>/` にあること。
- runtime smoke の証跡が `web-client/artifacts/webclient/runtime-gate-ready/<RUN_ID>/` にあること。
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
6. ORCA Trial または承認済み接続先で、`QA_PATIENT_ID` に current ORCA 環境で patient search 可能な患者IDを渡して `node scripts/qa-acceptmodv2-weborca.mjs` を実行する。
7. 同じ環境・同じ `RUN_ID`・同じ `QA_PATIENT_ID` で `node scripts/qa-fullflow-weborca.mjs` を実行する。
8. reception / charts / patients / admin の手動 smoke を実行する。

## 4. Smoke 観点
- Reception:
  - 既存患者検索が official `patientlst3v2` 条件で通る。
  - `既存患者受付/患者検索` モーダルから患者検索結果を選択し、`受付する` が current 導線で機能する。
  - `Api_Result=21` は保険不一致、`Api_Result=60` は受付なしとして表示される。
  - `Medical_Information` は UI 選択時のみ送信し、未選択なら送信しない。
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
- `qa-fullflow-weborca.mjs` は reception -> charts -> claim/income/support の一連の network とスクリーンショットを残す。
- patient search が 0 件なら `QA_PATIENT_ID` の不足/不一致として扱い、trial/local seed 不一致のまま「UI 不具合」と誤判定しない。
- `QA_MEDICAL_INFORMATION` を指定しない run を 1 本含め、未選択時に `Medical_Information` が未送信であることを証跡化する。

## 6. 成功判定
- 上記コマンドと smoke が成功し、artifact が同じ RUN_ID に束ねられている。
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
