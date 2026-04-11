# ORCA Remediation Cutover

最終更新: 2026-04-12  
用途: Worker G の post-merge verification 後に、ORCA remediation 一式を本番相当へ切り替えるための cutover / rollback 正本

## 1. 前提
- `master` に Worker G の最終修正が入っていること。
- `docs/runbooks/release-validation.md` の必須コマンドが成功していること。
- ORCA 接続確認の証跡が `artifacts/orca-connectivity/<RUN_ID>/` にあること。
- runtime smoke の証跡が `web-client/artifacts/webclient/runtime-gate-ready/<RUN_ID>/` にあること。

## 2. 事前チェック
- `PublicRouteInventoryContractTest` / `WebXmlEndpointExposureTest` / `verify-no-blocked-orca-route-strings.mjs` が current taxonomy を保持している。
- `PatientsPage` と chart patient edit が official `patientmodv2` update を使う。
- `acceptmodv2` の `Api_Result=21/60` が UI / server test で揃っている。
- `patientlst3v2` request / response が official 契約に沿っている。
- `manageusersv2` create/update XML が official 契約に沿っている。
- `contraindicationcheckv2` と `incomeinfv2` が UI / server contract / test で揃っている。
- `medicationgetv2` は 01/02 契約で drift がなく、診療日未解決時に fail-close する。

## 3. 実施順序
1. `cd web-client && npm run ci`
2. `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
3. `cd web-client && node scripts/runtime-ready-smoke.mjs`
4. `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`
5. ORCA Trial または承認済み接続先で reception / charts / patients / admin の smoke を実行する。

## 4. Smoke 観点
- Reception:
  - 既存患者検索が official `patientlst3v2` 条件で通る。
  - `Api_Result=21` は保険不一致、`Api_Result=60` は受付なしとして表示される。
- Charts:
  - chart send/finish の official outbound が `medicalmodv2` と `incomeinfv2` に限定される。
  - `contraindicationcheckv2` が UI から呼ばれる。
  - `medicationgetv2` は 9 桁コード + 開始日ありの時だけ候補取得し、診療日未解決では fail-close する。
- Patients:
  - official create / update / import が分離され、成功後に canonical re-fetch + local sync される。
  - chart patient edit が Patients と同じ official update route を使う。
- Admin:
  - `manageusersv2` list / create / update / delete が current XML 契約どおり送信される。

## 5. 成功判定
- 上記コマンドと smoke が成功し、artifact が同じ RUN_ID に束ねられている。
- route / DTO / docs / tests のどれにも旧 route / 旧 schema / 旧文言が残っていない。
- release owner が GO 判定できるだけの証跡が揃っている。

## 6. Rollback 条件
- `npm run ci`、`mvn ... verify`、runtime smoke のいずれかが失敗した。
- ORCA 接続確認で allowlist 外接続、権限逸脱、旧 route 再混入が見つかった。
- Reception / Charts / Patients / Admin の smoke で official 契約に反する挙動が出た。

## 7. Rollback 手順
1. 新しい deploy / 切替を停止する。
2. 直前の安定コミットまたは release artifact に戻す。
3. `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` で戻し先を再起動する。
4. Reception の検索 / 受付、Charts の閲覧、Patients の一覧、Admin の接続確認だけを最小 smoke で再確認する。
5. rollback 後の証跡を同じ RUN_ID 配下に `rollback` として残す。

## 8. 再実行条件
- root cause を code / test / docs に反映済みであること。
- rollback 後の最小 smoke が成功していること。
- 新しい RUN_ID を採番し、cutover を 2. からやり直すこと。
