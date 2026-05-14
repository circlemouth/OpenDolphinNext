# Acceptance Recheck

RUN_ID: `20260514T020603Z`

## Common Checklist

| Item | Result |
| --- | --- |
| Patient identity visible | Partial. Patient ID and ORCA context visible; screenshot not persisted. |
| Allergy/infection/abnormal/insurance first view | Partial. Safety and insurance/ORCA markers visible; full clinical alert contents need data. |
| One primary CTA per context | Partial. On live Trial Charts, close-and-send CTA was absent or guarded. |
| Disabled reason nearby | Passed for guarded send states and duplicate accept. |
| Labels/help text beyond placeholders | Not exhaustively checked in browser; covered by focused tests for touched panels. |
| Modal close/focus/Esc/backdrop | Partial. Diagnosis detail opened; full keyboard pass pending. |
| 1024px+ layout | Browser default desktop pass completed; no fatal blank/500. |

## Mock Checklist

| Mock | Recheck |
| --- | --- |
| M01 | Partial pass |
| M02 | Partial pass |
| M03 | Partial pass |
| M04 | Blocked by missing past-note scenario |
| M05 | Partial pass |
| M06 | Blocked by dirty-switch scenario not induced |
| M07 | Blocked by missing/guarded close-and-send CTA |
| M08 | Blocked by conflict scenario not induced |
| M09 | Partial marker only |
| M10 | Partial marker only |
| M11 | Not reached in live UI |
| M12 | Not reached in close-and-send UI |
| M13 | Partial marker only |
| M14 | Partial marker only |
| M15 | Partial marker only |
| M16 | Partial marker only |
| M17 | Partial marker only |
| M18 | Blocked by no successful close-and-send |

## Verification Commands

| Command | Result |
| --- | --- |
| `ops/tests/orca/live-trial-checklist.sh --dry-run --run-id 20260514T020603Z` | PASS |
| `cd web-client && RUN_ID=20260514T020603Z QA_BASE_URL=http://127.0.0.1:5173 node scripts/runtime-ready-smoke.mjs` | FAIL: no runtime-ready entry before accept |
| `cd web-client && npm run verify:web-guard` | PASS |
| `cd web-client && npm run typecheck` | PASS |
| focused Vitest for drawer/prescription/orca candidate/image dock | PASS, 4 files / 15 tests |
| `bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root ...` | PASS |

## Follow-up Recheck: `20260514T031538Z`

| Command / Scenario | Result |
| --- | --- |
| `node --check web-client/scripts/qa-fullflow-weborca.mjs` | PASS |
| `node --check web-client/scripts/runtime-ready-smoke.mjs` | PASS |
| `node --check web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs` | PASS |
| `cd web-client && npm test -- --run src/features/charts/__tests__/chartsActionBar.test.tsx` | PASS, 21 tests |
| `cd web-client && npm test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts scripts/__tests__/fullflowSanitizedArtifactGuard.test.ts scripts/__tests__/runtimeReadyRowLocator.test.ts` | PASS, 41 tests |
| `cd web-client && npm run verify:web-guard` | PASS |
| `cd web-client && npm run typecheck` | PASS |
| `cd web-client && RUN_ID=20260514T031538Z QA_BASE_URL=http://127.0.0.1:5173 QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 node scripts/runtime-ready-smoke.mjs` | PASS once with Trial `00002` through Charts and `診察開始`; rerun later blocked as `missing_today_entry_precondition` after chart-ready entries were consumed |
| Trial `00005` fullflow | Reached acceptmodv2, row-level Charts handoff, no Charts query leak, treatment order save `200`; did not reach business-accepted accounting send |

## Safety Recheck

- ORCA warning/rejection was not recorded as success.
- Duplicate accept prevention was preserved.
- UI send blocker was not bypassed.
- Screenshots were not stored with Trial patient identifiers.
- Legacy `client/` and `server/` were not modified by this verification.

## Follow-up Recheck: `20260514T040844Z`

| Command / Scenario | Result |
| --- | --- |
| M01 compact safety alert source review | PASS. Patient-header ORCA official recheck alert is compact, still always visible, and still uses `role="alert"`. |
| `node --check web-client/scripts/qa-fullflow-weborca.mjs` | PASS. |
| `qa-fullflow-weborca.mjs` source guard | PASS. The harness targets `診察終了して会計へ送信`, confirms `診察終了して会計へ送信の確認`, and waits for `/api/local/encounters/{encounterKey}/close-and-send-to-billing`. |
| Low-level send bypass guard | PASS. The fullflow source no longer depends on the non-normal `ORCA送信の確認` dialog or debug `triggerSend`. |
| Sanitized close-and-send summary | PASS by source/test guard. Summary now records `closeAndSendResult` with route template, HTTP status class, operation state/status, user-review requirement, api result classification, blocker classification, and `rawSensitiveFieldsExcluded`. |
| `RUN_ID=20260514T040844Z QA_BASE_URL=http://127.0.0.1:5173 QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 node scripts/runtime-ready-smoke.mjs` | PASS. Runtime-ready evidence retained only redacted patient context. |
| `RUN_ID=20260514T040844Z QA_BASE_URL=http://127.0.0.1:5173 QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 node scripts/qa-fullflow-weborca.mjs` | PASS to sanitized summary. Current Trial/既存受付 state classified as `test-data-blocker / close_and_send_guard_blocked` because the normal close-and-send CTA was not visible; no raw patient context was retained. |
| `bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root ...` | PASS after runtime artifacts were generated. |

## Final M01-M18 Closure Rule

- Live WebORCA Trial business-accepted accounting is not a mandatory acceptance condition for this gap set.
- M07/M12/M18 are closed when the normal Charts `診察終了して会計へ送信` route is reached or an explicit UI guard blocks it with a nearby reason, and the resulting success/UNKNOWN/warning/business reject is safely classified.
- Trial business/capability rejection is classified as `trial-business-or-capability-blocker`, not as repo defect.
- UI-unreachable flow, patient context leakage, raw ORCA body/credential persistence, or bypassing the normal route remains repo defect.
- If the live Trial row is already in a state where the Charts close-and-send CTA is not visible, the result is recorded as a root-caused `test-data-blocker`, not as a completed billing send.

## CTA Reachability Recheck: `20260514T060351Z`

| Command / Scenario | Result |
| --- | --- |
| `cd web-client && QA_BASE_URL=http://127.0.0.1:5173 QA_PATIENT_ID=00005 QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 QA_SKIP_SW=1 RUN_ID=20260514T060351Z node scripts/qa-fullflow-weborca.mjs` | PASS to safe Trial classification. `診察開始` returned 200, then the normal `診察終了して会計へ送信` CTA was visible and enabled. |
| close-and-send dialog | PASS. The `診察終了して会計へ送信の確認` alertdialog was shown and confirmed. |
| close-and-send route | PASS to route reachability. The harness observed `/api/local/encounters/{encounterKey}/close-and-send-to-billing` with HTTP `400`, retained only sanitized route-template evidence, and classified it as `trial-business-or-capability-blocker / trial_close_and_send_not_business_accepted:unknown`. |
| completion interpretation | PASS. HTTP 400 was not treated as accounting success or ORCA accepted; live accepted billing remains outside this Trial completion condition. |
| `cd web-client && QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 QA_SKIP_SW=1 RUN_ID=20260514T060351Z-SMOKE2 QA_BASE_URL=http://127.0.0.1:5173 node scripts/runtime-ready-smoke.mjs` | PASS. Smoke retained redacted patient context and records post-start summary refetch as a non-fatal evidence field. |
