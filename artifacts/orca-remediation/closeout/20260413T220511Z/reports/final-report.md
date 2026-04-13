# ORCA Closeout Recovery Final Report

- RUN_ID: `20260413T220511Z`
- Accepted Branch: `codex/orca-closeout-recovery-20260413T220511Z`
- Accepted HEAD: `0b0c7184eda898098cedccaced3ccb72c4a56b8b`
- Excluded Bundle: `20260413T104000Z`
- Accepted Bundle: `artifacts/orca-remediation/closeout/20260413T220511Z/`

## 結論

- PR2 は narrow reopen で close。`/api/orca/official/patients/import` の blind 500 は repo defect だった。
  - 真因は local `d_patient` upsert 前の `hibernate_sequence` drift。
  - 修正後は current accepted HEAD で `patientId=01423` の import rerun が `200 / apiResult=00`。
  - current bundle には request/response, sequence before/after, access/audit/transport log を保存した。
- PR3 は narrow reopen で close。synthetic `Voucher_Number` / `Sequential_Number` は source から除去された状態を code+test+QA evidence で固定した。
  - official visit identifiers は `visitptlstv2` 実値のみを正本とし、handoff key から補完しない。
  - fail-close は維持され、official identifiers 不足時は chart send を unblock しない。
- PR6 は code reopen なしで close。
  - current accepted HEAD / current RUN_ID / same patient 条件(`01424`)で live rerun を実施した。
  - `send` 到達は未達。ただし未達理由は third party が再読可能な evidence で説明可能になった。
- G1 は close。
  - PR2/PR3 の残件は accepted HEAD で解消し、旧 bundle `20260413T104000Z` を受入れ候補から外した。
- G6 は close。
  - live rerun は `send` 未到達だが、blocker は同一 RUN_ID bundle で再読可能な形に揃えた。

## PR2: import wrapper failure

- 修正対象:
  - `server-modernized/src/main/java/open/dolphin/session/PatientServiceBeanSupport.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientSyncResource.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaPatientSyncResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/session/PatientServiceBeanSyncPatientUpsertTest.java`
- 是正内容:
  - sync upsert 前に `hibernate_sequence` を `d_patient.max(id)` へ self-heal。
  - import failure を generic 500 のまま返さず、controlled failure へ mapping。
- current run evidence:
  - `evidence/sa-b-patient-import/import-response.json`
  - `evidence/sa-b-patient-import/sequence-before.tsv`
  - `evidence/sa-b-patient-import/sequence-after.tsv`
  - `evidence/sa-b-patient-import/import-stacktrace.log`
- 注記:
  - current runtime surface では `patientlst2v2` raw XML dump を再採取できなかった。
  - current run では transport/audit/access evidence を採取し、raw XML は accepted bundle の判定根拠には含めていない。

## PR3: handoff/source-of-truth

- 修正対象:
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`
  - `web-client/scripts/qa-fullflow-weborca.mjs`
  - test updates in server/web client
- 固定した契約:
  - `Acceptance_Id` / `scheduleKey` を `Voucher_Number` / `Sequential_Number` の代用にしない。
  - `patientId` only fallback を復活させない。
  - projected visit row は official identifiers を捏造しない。
  - official identifiers 不足時は `send` を fail-close のまま止める。
- 回帰確認:
  - `OrcaVisitResourceTest`
  - `OrcaXmlMapperTypedTextParsingTest`
  - `receptionHandoff.test.ts`
  - `chartsActionBar.test.tsx`
  - `encounterContext.test.ts`

## PR6 / G6: live rerun closeout

- same patient condition:
  - final accept/fullflow rerun patient は `01424` に統一。
- current run observation:
  - direct probe `appointments/medical-information` は一貫して `502 orca_gateway_error`。
  - server log では `OrcaAppointmentResource#medicalInformationOptions` が `Session layer failure` を出している。
  - `01424` の candidate probe では `acceptmodv2` が `apiResult=K3 / 受付登録終了` を返し active entry を作成。
  - その後の `acceptmodv2` / `fullflow` rerun では `apiResult=16` の duplicate accept。
  - にもかかわらず current contract の `official/visits/list` は当日 active row を返さず、smoke fallback row (`0000001`) しか見えない。
  - そのため charts canonical handoff は `scheduleKey=''`, `encounterKey=''`, `title='当日の active entry がないためカルテを開けません'` で fail-close。
- current run evidence:
  - `qa/acceptmodv2/accept-summary.json`
  - `qa/fullflow/summary.json`
  - `qa/fullflow/steps.log`
  - `qa/fullflow/network/network.json`
  - `qa/fullflow/network/requests.json`
  - `qa/fullflow/console.json`
  - `qa/fullflow/page-errors.json`
  - `evidence/sa-c-medical-information-probe/response.json`
  - `evidence/sa-c-runtime-blockers/server-log-snippets.log`
  - `evidence/sa-c-candidate-probes/candidate-probes.jsonl`
- 判定:
  - `send` 未到達の主因は current environment / upstream blocker。
  - accepted HEAD で repo-side closeout に必要な分類・証跡は揃ったため、PR6 と G6 は reopen せず close する。

## 検証

- server tests:
  - `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaVisitResourceTest,OrcaXmlMapperTypedTextParsingTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaPatientSyncResourceTest,PatientServiceBeanSyncPatientUpsertTest -Dsurefire.failIfNoSpecifiedTests=false test`
- web tests:
  - `npm test -- --run src/features/reception/__tests__/receptionHandoff.test.ts src/features/charts/__tests__/chartsActionBar.test.tsx src/features/charts/__tests__/encounterContext.test.ts`
- build:
  - `npm run build`
  - `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests package`

## 残リスク

- `appointments/medical-information` 502 の upstream/session-layer failure は current environment 側に残っている。
- `acceptmodv2` が active entry を返しても `official/visits/list` が canonical handoff 用 row を返さないケースが current environment で残っている。
- ただし今回の closeout では broad reopen を避け、repo-side residual reopen は増やしていない。
