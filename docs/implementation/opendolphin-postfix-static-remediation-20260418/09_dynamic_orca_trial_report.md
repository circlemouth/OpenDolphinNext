# Dynamic ORCA / WebORCA Trial Report

- Remediation RUN_ID: `20260418T224551Z`
- Original blocker RUN_ID: `20260418T220502Z`
- Date: `2026-04-18T22:45:51Z` - `2026-04-18T23:17:00Z`
- Scope: Phase 1 runtime-ready harness remediation, local paired stack reproducibility, read-only WebORCA preflight, gated Phase 3 acceptmodv2 attempt

## 1. dynamic trial verdict

**PARTIAL / ENVIRONMENT BLOCKER**

Accepted:
- Phase 1 `runtime-ready-smoke.mjs` rerun passed on the local paired stack.
- Row resolution no longer depends only on visible text. It resolved by `data-encounter-key`, with `visibleRowCount=2`, active tab `予約`, selected date `2026-04-19`.
- `qa-weborca-readonly-preflight.mjs` passed for `QA_PATIENT_ID=0000001`: authenticated medical-information route HTTP 200 / `apiResult=00`, patient search selectable, and required accept select controls present.
- C7 browser payload gate captured one Phase 3 mutation request with `checkedRequests=1` and `violationCount=0`.

Not accepted:
- `qa-acceptmodv2-weborca.mjs` reached the mutation route, but live business result was HTTP 200 / `apiResult=10` / `患者番号に該当する患者が存在しません`. This is not live ORCA mutation success.
- `qa-fullflow-weborca.mjs` was not executed because Phase 3 business success was not accepted.
- `visitptlstv2` remains HTTP 200 / `apiResult=13`; it is not a visit-list business success.

Classification:
- Original Phase 1 blocker: **resolved test harness / row locator issue**.
- Remaining blocker: **environment / test-data blocker**. The local patient is searchable and selectable locally, but WebORCA Trial rejected it at acceptmodv2 mutation time.

## 2. executed commands table

| command | cwd | result | log path | accepted |
| --- | --- | ---: | --- | --- |
| `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` attempts | repo root | mixed, final stack ready | `dynamic-logs/20260418T224551Z-setup-modernized-env*.log` | yes, final Vite/stack availability |
| `node scripts/runtime-ready-smoke.mjs` | `web-client` | pass | `dynamic-logs/20260418T224551Z-runtime-ready-smoke-final.log` | yes, Phase 1 accepted |
| `node scripts/qa-weborca-readonly-preflight.mjs` with `QA_PATIENT_ID=0000001` | `web-client` | pass | `dynamic-logs/20260418T224551Z-qa-weborca-readonly-preflight-final.log` | yes, read-only preflight accepted |
| `node scripts/qa-weborca-readonly-preflight.mjs` with `QA_PATIENT_ID=01481` | `web-client` | rejected | `dynamic-logs/20260418T224551Z-qa-weborca-readonly-preflight-01481.log` | no, patient search returned 0 |
| `node scripts/qa-acceptmodv2-weborca.mjs` with `QA_PATIENT_ID=0000001` | `web-client` | business rejected | `dynamic-logs/20260418T224551Z-qa-acceptmodv2-weborca-final.log` | no, `apiResult=10` |
| `npm run verify:web-guard` | `web-client` | pass | terminal verification | yes |
| `npm test -- --run scripts/__tests__ src/features/reception src/features/outpatient src/features/patients src/features/charts` | `web-client` | pass, 121 files / 823 passed / 2 skipped | terminal verification | yes |
| `npm run typecheck` | `web-client` | pass | terminal verification | yes |
| `bash -n setup-modernized-env.sh` and `node --check` for touched scripts | repo / `web-client` | pass | terminal verification | yes |

## 3. not executed table

| command | reason |
| --- | --- |
| `cd web-client && QA_PATIENT_ID=0000001 node scripts/qa-fullflow-weborca.mjs` | Not executed because Phase 3 acceptmodv2 business success was rejected. |
| destructive or cleanup operations on WebORCA Trial | Not executed. No accepted Trial-side registration state was created by this run. |

## 4. accepted live ORCA claim table

| claim | status | evidence |
| --- | --- | --- |
| Authenticated official medical-information route succeeds | accepted | `qa-weborca-readonly-preflight-final`: HTTP 200 / `apiResult=00` / `itemsCount=8` |
| `appointlstv2` returns HTTP 200 / `apiResult=00` | accepted | `runtime-ready-smoke-final`: appointments/list `apiResult=00`, `slotsCount=2` |
| `visitptlstv2` is a successful visit-list business result | rejected | `runtime-ready-smoke-final` and preflight show HTTP 200 / `apiResult=13` |
| runtime-ready local paired stack smoke | accepted | row resolution `encounterKey`, chart open/start transition succeeded |
| read-only QA patient preflight | accepted | `QA_PATIENT_ID=0000001`, selectable local result, required select options present |
| acceptmodv2 live mutation business success | rejected | mutation route returned HTTP 200 / `apiResult=10` |
| fullflow WebORCA success | not verified | script not executed |

## 5. C7 payload gate evidence

Accepted only for field-presence gating, not for business success.

- Script: `qa-acceptmodv2-weborca.mjs`
- `checkedRequests`: `1`
- field presence `violationCount`: `0`
- `QA_MEDICAL_INFORMATION`: unset, and no `medicalInformation` field was captured in the mutation browser request body.
- Business result: rejected, HTTP 200 / `apiResult=10`.

## 6. C5 import/canonical evidence

Not verified dynamically in this run. No patient import/canonical readback flow was executed.

## 7. C3/C6 charts/invoice evidence

Not verified dynamically in this run. `qa-fullflow-weborca.mjs` was not executed because Phase 3 business success was rejected.

## 8. runtime-ready-smoke row resolution evidence

- Added row metadata on Reception rows/cards: `data-encounter-key`, `data-schedule-key`, `data-reception-id`, `data-appointment-id`.
- Row locator priority is now encounter key, schedule key, reception ID, appointment ID, patient ID + name, then visible text fallback.
- `runtime-ready-before-row-wait.json` captures sanitized appointment evidence, selected smoke entry, visible rows summary, active status tab, selected date, and request/response summaries before waiting for the row.
- Final rerun resolved by `encounterKey`, found 2 visible rows, used active tab `予約`, selected date `2026-04-19`, and completed chart start transition.

## 9. read-only preflight evidence

- `QA_PATIENT_ID=0000001`: accepted.
  - login/session check: HTTP 200.
  - medical-information: HTTP 200 / `apiResult=00` / `itemsCount=8`.
  - patient search: selectable result count `1`.
  - department / physician / visit kind / payment mode / medical-information selectors: present with desired/default options.
  - C7: not verified by preflight because no mutation is executed.
- `QA_PATIENT_ID=01481`: rejected as test-data blocker; patient search returned 0 local results.

## 10. sanitize/security evidence

- Dynamic logs and closeout artifacts were scanned for raw `Authorization`, cookie headers, `JSESSIONID`, raw dev password, Basic credentials, `sessionMeBody`, and unredacted `x-csrf-token`; no raw matches remained after sanitization.
- Logs intentionally retain redacted placeholders such as `ORCA_API_PASSWORD=<redacted>` and `x-csrf-token=<<redacted>>`.
- `qa-acceptmodv2-weborca.mjs` and `qa-weborca-readonly-preflight.mjs` now redact CSRF headers in captured network artifacts.
- `runtime-ready-smoke.mjs` and `qa-acceptmodv2-weborca.mjs` no longer persist full `sessionMeBody` in summaries.
- Patient context is still treated as evidence-only local QA context; package inclusion must prefer report summaries over raw screenshots / raw JSON artifacts.

## 11. environment blockers

1. The original Vite PID-only startup signal was insufficient. `setup-modernized-env.sh` now waits for actual `https://localhost:5173/` availability and process liveness; tmux-backed startup kept the dev server alive for dynamic runs.
2. Local smoke seed now uses the same `DEV_SMOKE_PATIENT_ID` for schedule and encounter projections. The default scheduled time remains Asia/Tokyo current date 09:00.
3. WebORCA Trial acceptmodv2 rejected the local preflight-accepted patient with `apiResult=10`. This blocks live mutation success and fullflow.

## 12. external ORCA trial ambiguities

- `visitptlstv2` HTTP 200 / `apiResult=13` can prove transport/auth reachability, but not visit-list business success.
- The Trial tenant did not accept `QA_PATIENT_ID=0000001` for mutation despite local searchability. This may require a Trial-native QA patient or a different approved fixture.
- No fullflow / claim / income / cleanup dynamic evidence was collected.

## 13. final recommendation

- Treat Phase 1 as remediated: row locator diagnostics, row metadata, setup availability, and runtime-ready smoke are green.
- Treat Phase 2 read-only connectivity/authentication as accepted with the existing limits.
- Do not claim live mutation success. Resolve the Trial QA patient mismatch, then rerun `qa-weborca-readonly-preflight.mjs` and `qa-acceptmodv2-weborca.mjs` with the same `RUN_ID` or a new closeout RUN_ID.
- Do not run `qa-fullflow-weborca.mjs` until Phase 3 acceptmodv2 business success is accepted.
