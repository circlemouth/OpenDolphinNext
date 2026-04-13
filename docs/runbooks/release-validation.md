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
- `Medical_Information` 未選択時は送信しない。
- `症状詳記（院内ローカル）`、official/local 境界、disabled reason が current UI copy と一致する。

5. web-client gate と full CI を実行する。
```bash
cd web-client && npm run verify:web-guard
cd web-client && npm run ci
```
期待結果:
- blocked route string / legacy auth drift / public secret の再混入がない。
- typecheck / test / build まで成功する。

6. runtime-ready smoke と ORCA smoke scripts を pair release 前提で実行する。
```bash
cd web-client && node scripts/runtime-ready-smoke.mjs
QA_PATIENT_ID=<ORCA searchable patientId> cd web-client && node scripts/qa-acceptmodv2-weborca.mjs
QA_PATIENT_ID=<ORCA searchable patientId> cd web-client && node scripts/qa-fullflow-weborca.mjs
```
期待結果:
- web-client と server-modernized を同じ remediation pair として起動した状態で成功する。
- `runtime-ready-smoke` は local smoke seed `0000001` を使うが、`qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` は official patient search で返る患者を必要とする。受入れでは `QA_PATIENT_ID` に current ORCA 環境で検索可能な患者IDを渡す。
- `qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` は `QA_MEDICAL_INFORMATION` 未指定時に `Medical_Information` を送らず、指定時だけ current select option を送る。
- artifact が `RUN_ID` 単位でまとまり、accept / fullflow / runtime-ready smoke の結果を同じ受入れ束へ添付できる。

## Worker G の post-merge 確認
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test
cd web-client && node scripts/verify-no-blocked-orca-route-strings.mjs
```

- `PublicRouteInventoryContractTest` で official / master / local / admin-internal inventory が current taxonomy と一致することを確認する。
- `WebXmlEndpointExposureTest` で `/api/*` exposure と `/api/orca/*` taxonomy が崩れていないことを確認する。
- `verify-no-blocked-orca-route-strings.mjs` で web-client source に taxonomy drift や blocked mock surface が残っていないことを確認する。
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
- `qa-acceptmodv2-weborca.mjs` と `qa-fullflow-weborca.mjs` が current 受付導線で完走し、`Medical_Information` 未選択時は未送信の証跡を残す。
- patient search が 0 件なら、script は `QA_PATIENT_ID` の不足/不一致を明示したエラーで停止する。
- direct runtime lookup grep は `ServerConfigurationResolver.java` の `ConfigProvider.getConfig()` 1 件だけを返す。
- `dolphin.facilityId` grep は 0 件。

## 証跡保存先
- runtime smoke の既知出力先は `web-client/artifacts/webclient/runtime-gate-ready/<RUN_ID>`。
- ORCA 接続確認の既知出力先は `artifacts/orca-connectivity/<RUN_ID>/`。
- Worker G の smoke memo / diff / grep 結果は release 判定に使う artifact 配下へまとめ、cutover 記録と分離しない。

## 手動確認
### Health
- [ ] `GET /api/health` が最小 payload を返す。
- [ ] `GET /api/health/readiness` が `status` だけを返す。
- [ ] 認証後の operations readiness が sanitize された詳細を返す。

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
- archive は repo root から作成する。
- 第一候補は `git archive` を使う。
- 手動 zip を作る場合も、`target/` / `*.war` / `__MACOSX` / `.DS_Store` / `Thumbs.db` を含めない。
- archive 生成後に `zipinfo -1` で禁止パターンを再検査する。

```bash
git archive --format=zip --output /tmp/OpenDolphinNext-clean.zip HEAD
```

```bash
zipinfo -1 /tmp/OpenDolphinNext-clean.zip | \
  rg '(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$' && exit 1 || true
```

## 補足
- `check-no-generated-artifacts.sh` は tracked / untracked の両方を検査する。
- `check-no-direct-runtime-lookup.sh` は `ServerConfigurationResolver.java` 以外の direct runtime lookup を許可しない。
- どれか 1 つでも失敗したら release は見送る。
- cutover / rollback の実施順序と停止条件は [../releases/orca-remediation-cutover.md](../releases/orca-remediation-cutover.md) を正本とする。
