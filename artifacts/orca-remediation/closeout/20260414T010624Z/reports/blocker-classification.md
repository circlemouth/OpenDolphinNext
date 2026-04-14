# Blocker Classification

## Scope

- RUN_ID: `20260414T010624Z`
- Accepted branch: `codex/orca-closeout-recovery-20260414T010624Z`
- Accepted HEAD: `cd50269d3dae361a6ea879c3045ce49e6d11c8a9`

## Canonical Classifications

| Area | Classification | Evidence | Rationale |
| --- | --- | --- | --- |
| `/api/orca/official/appointments/medical-information` old `502` | `repo-fixed` | `evidence/medical-information-probe/probe-summary.json`, `evidence/medical-information-probe/route-response.json`, `evidence/medical-information-probe/raw-response.xml`, `evidence/medical-information-probe/server-stacktrace.log` | direct upstream probe と app route が current RUN_ID でともに `200`。external blocker 判定は棄却。 |
| `/api/orca/official/patients/import` blind `500` | `repo-fixed` | `evidence/patients-import/import-summary.json`, `evidence/patients-import/import-response.json`, `evidence/patients-import/canonical-refetch-response.json`, `evidence/patients-import/local-search-response.json` | current rerun は `200 / apiResult=00`。blind 500 は current accepted HEAD に残っていない。 |
| accept rerun for patient `01424` | `test-data-blocker` | `qa/acceptmodv2/accept-summary.json`, `evidence/runtime-blockers/server-log-acceptmodv2-duplicates.log` | route status は `200` だが `apiResult=16` で duplicate registration を返し、canonical acceptance key が出ない。 |
| accept -> charts handoff for patient `01423` | `test-data-blocker` | `qa/fullflow/summary.json`, `qa/fullflow/network/network.json`, `qa/fullflow/handoff-state.json`, `evidence/runtime-blockers/blocker-summary.json` | accept network も `apiResult=16`。その後の `appointments/list` / `visits/list` は fallback smoke row `0000001` しか返さず、charts button は `scheduleKey=''`, `encounterKey=''` の fail-close 状態。 |
| `qa/fullflow/request-xml/medicalmodv2.xml` 未採取 | `not-verified` | `qa/fullflow/summary.json`, `qa/fullflow/steps.log` | send 未到達なので XML は存在しない。live pass の根拠にできない。 |

## Rejected Misclassifications

### 1. `appointments/medical-information` を external blocker と断定する

- current RUN_ID の direct upstream probe は `HTTP 200 / Api_Result=00`
- current RUN_ID の app route も `HTTP 200`
- root cause fix は `review-checkout/server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java` に入り、fixture も `medicalinfres` root に更新済み
- よって、direct probe / route / server evidence を取る前に external blocker と決め打ちしていた旧判断は受入れ対象外

### 2. `Acceptance_Id` / `scheduleKey` を official `Voucher_Number` / `Sequential_Number` の代用にする

- patient `01424` accept rerun では `acceptanceId=''`, `encounterKey=''`, `scheduleKey=''`
- patient `01423` fullflow rerun でも `handoff-state.json` の button state は `scheduleKey=''`, `encounterKey=''`
- official visit row がない状態で synthetic handoff key を作る余地は残していない

### 3. patientId-only fallback を復活させる

- fullflow は send を進めず fail-close で停止している
- `qa/fullflow/summary.json` が `no_request_xml` を記録しており、patientId だけで send を通した形跡はない

## Reviewer Reading Order

1. `evidence/medical-information-probe/probe-summary.json`
2. `evidence/patients-import/import-summary.json`
3. `qa/acceptmodv2/accept-summary.json`
4. `qa/fullflow/summary.json`
5. `qa/fullflow/network/network.json`
6. `evidence/runtime-blockers/server-log-acceptmodv2-duplicates.log`
7. `reports/final-report.md`
