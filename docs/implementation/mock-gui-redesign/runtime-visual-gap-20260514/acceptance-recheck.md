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
