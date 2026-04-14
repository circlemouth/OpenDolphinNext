# ORCA Closeout Recovery Final Report

## 1. 総合 verdict

- Verdict: `PASS`
- Reviewer recommendation: `PR2 close`, `PR3 close`, `PR6 close`
- current accepted source of truth `codex/orca-closeout-recovery-20260414T010624Z@cd50269d3dae361a6ea879c3045ce49e6d11c8a9` では、patients/import success evidence の current RUN_ID 再採取、`appointments/medical-information` 502 の repo defect 是正、reviewer submission packet の actual checkout 同梱化が揃った。live ORCA send は未成功であり `medicalmodv2.xml` も未取得だが、未到達理由は repo defect ではなく `Api_Result=16` 二重登録疑いと fallback smoke row のみ返る runtime/test-data 条件として third party が再読できる形で固定できた。したがって closeout は完了、live pass は未主張とする。

## 2. accepted source of truth

- Accepted branch: `codex/orca-closeout-recovery-20260414T010624Z`
- Accepted HEAD: `cd50269d3dae361a6ea879c3045ce49e6d11c8a9`
- RUN_ID: `20260414T010624Z`
- Merge-base to `origin/master`: `fecd6cde13a5a60441e5aeec9818afe09c9b52db`
- Provenance evidence:
  - `git/run-id.txt`
  - `git/accepted-branch.txt`
  - `git/git-head-current.txt`
  - `git/git-branch-current.txt`
  - `git/git-merge-base-origin-master.txt`
  - `git/git-status-short.txt`
  - `git/git-diff-stat.txt`
  - `git/git-log-oneline.txt`
- accepted source of truth は上記 git evidence が同一 RUN_ID / 同一 branch / 同一 HEAD を指す current closeout root のみとし、旧 bundle は参照専用とした。

## 3. 何を直したか

- PR2 import
  - `/api/orca/official/patients/import` を current RUN_ID で rerun し、`HTTP 200 / apiResult=00 / updatedCount=1` を採取した。
  - raw upstream request/response、route response、canonical refetch、local search、server-side note を `evidence/patients-import/` に再集約した。
- PR3 runtime blocker
  - `review-checkout/server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java` で `medicalinfres` root を正しく解決し、`Medical_Information_Name2` を含む XML を正規化することで `/appointments/medical-information` 502 の repo defect を塞いだ。
  - `review-checkout/server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java` で canonical acceptance を前提に projection / realtime publish を fail-close に寄せ、`K3` warn-success のみを受理するよう整理した。
  - `review-checkout/server-modernized/src/test/java/open/dolphin/rest/orca/OrcaAppointmentResourceTest.java`
  - `review-checkout/server-modernized/src/test/java/open/dolphin/rest/orca/OrcaVisitResourceTest.java`
  - `review-checkout/server-modernized/src/test/java/open/dolphin/rest/orca/OrcaVisitResourceRealtimeTest.java`
  - `review-checkout/server-modernized/src/test/resources/orca/stub/44_system01lstv2_response.sample.xml`
- PR6 packet / provenance / evidence
  - `review-checkout/scripts/reviewer-submission-packet.mjs` を actual `review-checkout/` + `closeout-packet/` + `manifest` の正本にし、`--accepted-head` freeze と forbidden tracked dir 除外を追加した。
  - `review-checkout/tests/review-packet/reviewer-submission-packet.test.mjs` に branch drift 時の `--accepted-head` freeze test を追加した。
  - `review-checkout/docs/runbooks/reviewer-submission-packet.md`
  - `review-checkout/docs/runbooks/release-validation.md`
  - `review-checkout/docs/releases/orca-remediation-cutover.md`
  - `reports/final-report.md`
  - `reports/command-log.md`
  - `reports/blocker-classification.md`

## 4. 実行した検証

| 検証 | 結果 | 主証跡 |
| --- | --- | --- |
| git provenance commands | PASS | `git/git-status-short.txt`, `git/git-head-current.txt`, `git/git-merge-base-origin-master.txt`, `git/git-diff-stat.txt` |
| `cd web-client && npm run verify:web-guard` | PASS | worker run log |
| `cd web-client && npm run ci` | PASS | `tests/web-ci.log` |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | PASS | `tests/server-verify.log` |
| targeted server tests | PASS | worker run log |
| `node --test tests/review-packet/reviewer-submission-packet.test.mjs` | PASS (`5/5`) | worker run log |
| direct upstream `system01lstv2` probe | PASS | `evidence/medical-information-probe/raw-request.xml`, `evidence/medical-information-probe/raw-response.xml`, `evidence/medical-information-probe/raw-response.headers` |
| app route `/api/orca/official/appointments/medical-information` | PASS | `evidence/medical-information-probe/probe-summary.json`, `evidence/medical-information-probe/route-response.json`, `evidence/medical-information-probe/server-stacktrace.log` |
| `/api/orca/official/patients/import` rerun | PASS | `evidence/patients-import/import-summary.json`, `evidence/patients-import/import-response.json`, `evidence/patients-import/canonical-refetch-response.json`, `evidence/patients-import/local-search-response.json` |
| `QA_PATIENT_ID=01424 node web-client/scripts/qa-acceptmodv2-weborca.mjs` | PASS with blocker capture | `qa/acceptmodv2/accept-summary.json`, `qa/acceptmodv2/steps.log` |
| `QA_PATIENT_ID=01423 node web-client/scripts/qa-fullflow-weborca.mjs` | FAIL with blocker capture | `qa/fullflow/summary.json`, `qa/fullflow/network/network.json`, `qa/fullflow/handoff-state.json`, `evidence/runtime-blockers/server-log-acceptmodv2-duplicates.log` |

## 5. live evidence summary

- accept summary
  - patient `01424`
  - `appointments/medical-information` probe は `HTTP 200`
  - accept route 自体は `HTTP 200` だが `apiResult=16`, `apiResultMessage=診療科・保険組合せで受付登録済みです。二重登録疑い`
  - `acceptanceId`, `encounterKey`, `scheduleKey` は空
  - classification: `test-data-blocker`
  - evidence: `qa/acceptmodv2/accept-summary.json`
- fullflow summary
  - patient `01423`
  - accept mutation は network capture 上 `apiResult=16` を返した
  - その後の `appointments/list` / `visits/list` は patient `0000001` の fallback smoke row しか返さず、charts handoff button は disabled のまま
  - `title=当日の active entry がないためカルテを開けません`
  - classification: `test-data-blocker`
  - evidence: `qa/fullflow/summary.json`, `qa/fullflow/network/network.json`, `qa/fullflow/handoff-state.json`
- send 到達有無
  - 未到達
  - `qa/fullflow/summary.json` の `sendResult.validation.reason` は `no_request_xml`
- `medicalmodv2.xml` 有無
  - なし
  - live ORCA send が成功していないため、`medicalmodv2.xml` を live pass として記載しない

## 6. appointments/medical-information 502 切り分け

- Classification: `repo-fixed`
- Evidence
  - `evidence/medical-information-probe/probe-summary.json`
  - `evidence/medical-information-probe/raw-request.xml`
  - `evidence/medical-information-probe/raw-response.xml`
  - `evidence/medical-information-probe/route-response.json`
  - `evidence/medical-information-probe/server-stacktrace.log`
- Source
  - `review-checkout/server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java`
  - `review-checkout/server-modernized/src/test/java/open/dolphin/rest/orca/OrcaAppointmentResourceTest.java`
  - `review-checkout/server-modernized/src/test/resources/orca/stub/44_system01lstv2_response.sample.xml`
- 結論
  - direct upstream probe と app route の両方が current RUN_ID で `200`。旧 502 は repo defect 側で解消済みであり、direct probe / route / stacktrace を取る前に external blocker と断定していた状態は受入れ対象外とする。

## 7. patients/import summary

- Target patient: `01423`
- Import route result
  - `HTTP 200`
  - `apiResult=00`
  - `fetchedCount=1`
  - `updatedCount=1`
  - evidence: `evidence/patients-import/import-summary.json`, `evidence/patients-import/import-response.json`
- Raw upstream evidence
  - `evidence/patients-import/raw-upstream-request.xml`
  - `evidence/patients-import/raw-upstream-response.xml`
  - `evidence/patients-import/raw-upstream-response.headers`
- Server-side evidence
  - `evidence/patients-import/server-stacktrace.log`
  - `evidence/patients-import/audit.log`
- Sync result
  - canonical refetch `HTTP 200`, patientIds=`01423`
  - local search `HTTP 200`, recordsReturned=`1`
  - evidence: `evidence/patients-import/canonical-refetch-response.json`, `evidence/patients-import/local-search-response.json`
- 結論
  - blind 500 は current RUN_ID で残らず、PR2 closeout evidence は current accepted HEAD に載せ直せた。

## 8. reviewer submission packet

- Packet directory: `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z`
- Packet zip: `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z.zip`
- create command
  - `./scripts/create-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z --accepted-head cd50269d3dae361a6ea879c3045ce49e6d11c8a9`
- validate command
  - `./scripts/validate-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z --accepted-head cd50269d3dae361a6ea879c3045ce49e6d11c8a9`
- HEAD consistency rule
  - `review-checkout/.git/HEAD`
  - `closeout-packet/git/git-head-current.txt`
  - `manifest.json.acceptedHead`
  - 上記 3 箇所はすべて `cd50269d3dae361a6ea879c3045ce49e6d11c8a9` に一致させる
- Status
  - create: `PASS`
  - validate: `PASS`
  - review-checkout HEAD: `cd50269d3dae361a6ea879c3045ce49e6d11c8a9`
  - closeout-packet HEAD: `cd50269d3dae361a6ea879c3045ce49e6d11c8a9`
  - manifest acceptedHead: `cd50269d3dae361a6ea879c3045ce49e6d11c8a9`
  - required files check: `PASS`
  - absolute path lint: `PASS`

## 9. G0〜G7 最終判定

| Gate | 判定 | 根拠 |
| --- | --- | --- |
| G0 | PASS | `git/git-head-current.txt`, `git/git-merge-base-origin-master.txt`, `git/git-diff-stat.txt` |
| G1 | PASS | `evidence/patients-import/import-summary.json`, `evidence/patients-import/canonical-refetch-response.json`, `evidence/patients-import/local-search-response.json` |
| G2 | PASS | `evidence/medical-information-probe/probe-summary.json`, `evidence/medical-information-probe/route-response.json` |
| G3 | PASS | `qa/acceptmodv2/accept-summary.json`, `qa/fullflow/summary.json`, `qa/fullflow/network/network.json`, `evidence/runtime-blockers/server-log-acceptmodv2-duplicates.log` |
| G4 | PASS | `tests/web-ci.log`, `tests/server-verify.log` |
| G5 | PASS | `review-checkout/docs/runbooks/release-validation.md`, `review-checkout/docs/releases/orca-remediation-cutover.md`, `review-checkout/docs/runbooks/reviewer-submission-packet.md` |
| G6 | PASS | `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z/manifest.json`, `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z/manifest.sha256`, `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z/closeout-packet/reports/final-report.md` |
| G7 | PASS | `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z/review-checkout/.git/HEAD`, `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z/closeout-packet/git/git-head-current.txt`, `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z/manifest.json` |

## 10. PR0〜PR6 最終判定

| PR | 判定 | 根拠 |
| --- | --- | --- |
| PR0 | NOT VERIFIED | 本 RUN_ID の主対象外。current accepted HEAD で再オープンを示す証跡なし。 |
| PR1 | NOT VERIFIED | 本 RUN_ID の主対象外。current accepted HEAD で再オープンを示す証跡なし。 |
| PR2 | PASS | `evidence/patients-import/import-summary.json`, `evidence/patients-import/canonical-refetch-response.json`, `evidence/patients-import/local-search-response.json` |
| PR3 | PASS | `evidence/medical-information-probe/probe-summary.json`, `qa/acceptmodv2/accept-summary.json`, `qa/fullflow/network/network.json`, `evidence/runtime-blockers/handoff-state.json` |
| PR4 | NOT VERIFIED | 本 RUN_ID の主対象外。current accepted HEAD で再オープンを示す証跡なし。 |
| PR5 | NOT VERIFIED | 本 RUN_ID の主対象外。current accepted HEAD で再オープンを示す証跡なし。 |
| PR6 | PASS | `review-checkout/scripts/reviewer-submission-packet.mjs`, `review-checkout/tests/review-packet/reviewer-submission-packet.test.mjs`, `review-checkout/docs/runbooks/reviewer-submission-packet.md` |

## 11. 残件がある場合

| Area | Severity | 何が残るか | Classification | 次の最小作業 |
| --- | --- | --- | --- | --- |
| live ORCA send | high | `medicalmodv2.xml` 未採取。live pass は未主張。 | `not-verified` | ORCA test data を整理し、duplicate registration を解消した patient で新 RUN_ID の fullflow rerun を行う |
| runtime/test data | high | patient `01423` / `01424` とも `acceptmodv2` が `Api_Result=16` を返し、handoff が active entry に到達しない | `test-data-blocker` | 環境側で重複受付状態を解消し、same facility / same department / same physician で rerun する |
| runtime-ready smoke | medium | smoke seed 行が見つからず timeout | `test-data-blocker` | current environment の seed を確認して smoke data を同期する |

## 12. 添付一覧

- `review-checkout/`
- `closeout-packet/git/`
- `closeout-packet/reports/final-report.md`
- `closeout-packet/reports/command-log.md`
- `closeout-packet/reports/blocker-classification.md`
- `closeout-packet/qa/acceptmodv2/`
- `closeout-packet/qa/fullflow/`
- `closeout-packet/evidence/patients-import/`
- `closeout-packet/evidence/medical-information-probe/`
- `closeout-packet/evidence/runtime-blockers/`
- `manifest.json`
- `manifest.sha256`
