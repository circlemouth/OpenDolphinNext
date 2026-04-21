# AGENT_B_REPORT

## Agent identity

```text
agent id: Subagent B - order local persistence matrix and ORCA boundary tests
model: gpt 5.4 high
worktree path: /Users/Hayato/Documents/GitHub/odn-wave1-agent-b
branch name: codex/wave1-agent-b-order-local-orca-boundary-tests
base branch: 02aa1434d20615c22c23fe5cbf80938e725cfd88
base commit: 02aa1434d20615c22c23fe5cbf80938e725cfd88
start time: 20260421T044925Z
end time: 20260421T050538Z
```

## Forbidden-action attestation

```text
external web lookup used: no
ORCA official spec lookup from web: no
live ORCA mutation: no
Phase 3/4/fullflow: no
production code changed: no
raw HAR/trace/video/screenshot included: no
raw XML/raw network body/credentials/cookies/tokens included: no
```

`npm ci` was used only to restore `web-client` dependencies in this worktree after `vitest` was missing. No external ORCA docs or live ORCA endpoints were accessed.

## Scope completed

| Item | Status | Notes |
|---|---:|---|
| Prescription local save/reload/edit/delete/copy boundary | done | `prescriptionOrderLocalRoundtripBoundary.test.ts` verifies local prescription API only and preserves RP/drug/usage/days/doctor comment/claim comments across the flow. |
| Generic local bundle matrix | done | `orderLocalPersistenceMatrix.test.ts` covers injection, test, physiology, bacteria, radiology, treatment, surgery, other. |
| Material row persistence | done | Dependent `materialItems` rows are asserted for injection/treatment/surgery; standalone material order entity was not introduced. |
| Doctor comment / claim comment boundary | done | Doctor comments are asserted in local payload; code-less claim comments fail before any transport. |
| Radiology bodyPart required/readback | done | Radiology local payload/readback preserves first-class `bodyPart`; static payload includes the body-part row only for sendable radiology. |
| Subtype preservation | done | `testOrder` specimen, `physiologyOrder` physiology, and `bacteriaOrder` culture/sensitivity-local shape are covered. |
| Order set / stamp field preservation | partial | `orderSetFieldPreservation.test.ts` documents current chart order set lossy risk for admin/adminCode/bundleNumber/materialItems/commentItems/bodyPart/subtype/bacteria. Stamp storage was not expanded. |
| Local API does not call ORCA mutation endpoints | done | New local API tests assert calls remain under `/api/local/order/bundles` or `/api/local/prescription-orders` and do not hit known ORCA mutation endpoints. |
| Static medicalmodv2 payload/block behavior | done | `orderLocalOrcaBoundary.test.ts` asserts static payload shape for sendable entities and blocks physiology/bacteria/other before payload construction. |

## Changed files

| File | Type | Reason |
|---|---|---|
| `web-client/src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts` | test | Local order bundle matrix and `/api/local/order/bundles` ORCA-boundary assertions. |
| `web-client/src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts` | test | Prescription local save/reload/edit/delete/copy flow and claim comment fail-closed boundary. |
| `web-client/src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts` | test | Static medicalmodv2 sendable payload and local-only/unsupported block assertions. |
| `web-client/src/features/charts/__tests__/orderSetFieldPreservation.test.ts` | test | Explicit current lossy-risk test for chart order set extended order fields. |
| `docs/codex/clinical-input-test-wave1-20260421/results/AGENT_B_REPORT.md` | doc | Subagent B sanitized report. |

## Tests added

| Test file | Test name | Purpose | Boundary |
|---|---|---|---|
| `orderLocalPersistenceMatrix.test.ts` | injection keeps drug, dependent material, comment, and admin fields | Injection local persistence matrix row. | local |
| `orderLocalPersistenceMatrix.test.ts` | testOrder keeps specimen subtype and comment row locally | Lab/test subtype and comment local preservation. | local |
| `orderLocalPersistenceMatrix.test.ts` | physiology keeps subtype locally without proving ORCA sendability | Physiology local save/readback without live ORCA claim. | local |
| `orderLocalPersistenceMatrix.test.ts` | bacteria keeps culture subtype and bacteria metadata locally | Bacteria subtype/metadata local preservation. | local |
| `orderLocalPersistenceMatrix.test.ts` | radiology requires and reads back bodyPart as a first-class local field | Radiology bodyPart local readback. | local |
| `orderLocalPersistenceMatrix.test.ts` | treatment keeps dependent material and comment rows locally | Treatment dependent material/comment preservation. | local |
| `orderLocalPersistenceMatrix.test.ts` | surgery keeps dependent material and comment rows locally | Surgery dependent material/comment preservation. | local |
| `orderLocalPersistenceMatrix.test.ts` | other keeps explicit local-only code and does not carry class meta | Other/local-only local preservation and class meta stripping. | local |
| `orderLocalPersistenceMatrix.test.ts` | treats material as dependent rows and does not introduce a standalone material order entity | Material is dependent row, not standalone material order type. | local |
| `prescriptionOrderLocalRoundtripBoundary.test.ts` | save -> reload -> edit -> delete -> copy from previous chart stays on local prescription API | Prescription local persistence lifecycle. | local |
| `prescriptionOrderLocalRoundtripBoundary.test.ts` | claim comment without code is rejected before local or ORCA transport | Claim comment fail-closed validation. | local |
| `orderLocalOrcaBoundary.test.ts` | builds static medicalmodv2 payload data only for sendable order entities | Static payload contract for sendable entities. | static |
| `orderLocalOrcaBoundary.test.ts` | blocks local-only or unsupported entities before static medicalmodv2 payload construction | Physiology/bacteria/other fail-closed before payload. | static |
| `orderLocalOrcaBoundary.test.ts` | keeps material rows dependent on a clinical parent row in static payload sources | Material row source-role preservation. | static |
| `orderSetFieldPreservation.test.ts` | documents current lossy risk for extended order bundle fields in chart order sets | Explicit order set lossy-risk evidence. | local |

## Matrix rows covered

| Row | Covered | Evidence |
|---|---:|---|
| prescription | yes | RP, drug, usage, days, doctor comment, claim comment, local save/reload/edit/delete/copy, local API only. |
| injection | yes | drug row, material row, comment row, admin/adminCode/adminMemo local payload/readback. |
| lab/test | yes | `testOrder` class 600 local save/readback, specimen subtype, static sendable payload. |
| physiology | yes | local save/readback subtype; static ORCA send block. |
| bacteria | yes | local save/readback subtype and metadata; static ORCA send block. |
| radiology | yes | bodyPart local readback and static payload body-part row. |
| treatment | yes | main/material/comment local preservation and static payload source role. |
| surgery | yes | main/material/comment local preservation and static payload source role. |
| other/local-only | yes | local-only explicit code preserved locally; static ORCA send block. |
| material | partial | Dependent material rows covered. Standalone material order type remains unsupported/not source-proven. |
| comments | yes | Prescription claim comment validation; order bundle comment rows preserved. |
| order set/stamp | partial | Chart order set lossy-risk documented; stamp extended field matrix not expanded. |

## Rows not covered and why

| Row | Reason |
|---|---|
| standalone material order | No source evidence found that material is a standalone order entity; tests assert dependent material rows instead. |
| full stamp extended field preservation | Assignment permitted test-only scope; current local stamp type does not model bodyPart/materialItems/commentItems/subtype/bacteria as first-class fields. Not expanded to avoid production/type changes. |
| live ORCA medicalmodv2 mutation | Explicitly forbidden in Wave 1. |
| ORCA official spec compatibility | External web/official spec lookup was forbidden. Mark any carrier ambiguity as 要 ORCA 公式仕様確認. |

## Local-vs-ORCA boundary assertions

- Local prescription flow uses `/api/local/prescription-orders` only.
- Local generic bundle matrix uses `/api/local/order/bundles` only.
- The tests assert no call URL includes:
  - `/api/orca/official/chart-support/medical-mod-v2`
  - `/api21/medicalmodv2`
  - `/orca21/medicalmodv2`
  - `/orca22/diseasev3`
  - `/orca25/subjectivesv2`
- Static ORCA payload tests call pure payload/normalization helpers only; they do not post to ORCA.
- MSW/unit/local/static test success was not described as live ORCA success.

## Static ORCA payload tests

| Case | Result |
|---|---|
| medOrder | Static medicalmodv2 information includes class 212, RP number, drug row, structured comment row. |
| injectionOrder | Static medicalmodv2 information includes class 310 with main/material/comment rows; local admin text does not become a local API success claim. |
| testOrder | Static medicalmodv2 information includes class 600 rows; local admin/memo/item memo are stripped from payload. |
| radiologyOrder | Static medicalmodv2 information includes bodyPart row and main radiology row. |
| treatmentOrder | Static medicalmodv2 information includes main/material/comment rows. |
| surgeryOrder | Static medicalmodv2 information includes main/material/comment rows. |
| physiologyOrder | Blocked with `unsupported_physiology_order`; no medicalInformation. |
| bacteriaOrder | Blocked with `unsupported_bacteria_order`; no medicalInformation. |
| otherOrder | Blocked with `invalid_other_order_class`; no medicalInformation. |

## Commands run

| Command | CWD | Result | Exit code | Output summary |
|---|---|---:|---:|---|
| `npm run test -- --run src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderSetFieldPreservation.test.ts` | `web-client` | FAIL | 127 | `pretest` web guard passed; `vitest` was missing because dependencies were not installed in this worktree. |
| `npm ci` | `web-client` | PASS | 0 | Installed 973 packages; peer/deprecation warnings only. |
| `npm run test -- --run src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderSetFieldPreservation.test.ts` | `web-client` | FAIL | 1 | 13/15 tests passed; failures were test expectation mismatches for generic flag default and `otherOrder` absent class fields. |
| `npm run test -- --run src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderSetFieldPreservation.test.ts` | `web-client` | FAIL | 1 | 14/15 tests passed; remaining failure was `otherOrder` fetch normalizing `className` to undefined. |
| `npm run test -- --run src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderSetFieldPreservation.test.ts` | `web-client` | PASS | 0 | `pretest` web guard passed; 4 test files passed, 15 tests passed. |

## Not-run commands

| Command or suite | Reason |
|---|---|
| `npm run typecheck` | Agent B prompt instructed targeted tests only. |
| `npm run lint` | Agent B prompt instructed targeted tests only. |
| `npm run build` | Agent B prompt instructed targeted tests only. |
| Playwright/e2e | Not added; Vitest API/static tests were stable and sufficient for this scope. |
| live ORCA smoke / Phase 3 / Phase 4 / fullflow | Forbidden for Wave 1 Agent B. |

## Failures / blockers

| Blocker id | Severity | Area | Description | Proposed next action |
|---|---:|---|---|---|
| B-LOS-001 | Medium | order set | `chartOrderSetStorage` currently persists only `entity`, `bundleName`, `classCode`, `className`, and `items`; extended fields such as `admin`, `adminCode`, `bundleNumber`, `materialItems`, `commentItems`, `bodyPart`, `subtype`, and `bacteria` are stripped. This is documented by a passing lossy-risk test, not fixed in Wave 1. | Coordinator should create a production implementation follow-up if order set reuse must preserve these fields. |
| B-SPEC-001 | Low | ORCA payload | Static medicalmodv2 payload assertions are repository-contract based only. Official carrier compatibility for any ambiguous field remains 要 ORCA 公式仕様確認. | Confirm against ORCA official spec in a permitted follow-up. |

## ORCA boundary statement

```text
Agent B did not perform live ORCA mutation; MSW/static/local tests are not live ORCA evidence.
```

## Merge recommendation

merge as-is

Rationale: The branch adds test-only coverage and a sanitized report, changes no production implementation, and targeted Vitest passes. The chart order set field loss is intentionally documented as a follow-up blocker rather than patched in this test-first scope.
