# ORCA Trial Phase 2.5 Gate Hardening Report

- RUN_ID: `20260419T120043Z`
- Scope: Phase 2.5 candidate discovery / exact preflight gate hardening, static evidence, read-only dynamic evidence, package evidence alignment.
- Overall dynamic verdict: `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER`
- Target readiness statement: source/test/docs/package are hardened for the next candidate attempt, but this run is not `READY TO RUN PHASE 3 IF EXACT PREFLIGHT PASSES` because no mutation-ready candidate was accepted and exact selected-candidate preflight was not run.
- Raw sensitive fields excluded: yes.

## 1. Overall Dynamic Verdict

`PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER`

Phase 2.5 candidate discovery completed fail-closed. No Trial-native mutation-ready candidate was accepted. Phase 3 and Phase 4 were intentionally not run. `acceptedCandidateCount=0` must not be read as proof that official initial patients do not exist; it means only that `00001`-`00011` did not have enough current read-only evidence across harness / API / auth / parser / readiness / exact-preflight criteria to authorize a mutation attempt.

## 2. Phase Status

| Phase | Status | Evidence |
| --- | --- | --- |
| Phase 1 runtime-ready | accepted | `dynamic-logs/20260419T120043Z-runtime-ready-smoke.log`, `dynamic-evidence/20260419T120043Z-runtime-ready-result.json` |
| Phase 2 read-only connectivity/auth | accepted historical evidence | retained `20260418T220502Z-*` read-only logs; no mutation claim |
| Phase 2.5 candidate discovery | completed fail-closed / test-data or harness readiness blocker | `dynamic-logs/20260419T120043Z-qa-weborca-candidate-discovery.log`, `dynamic-evidence/20260419T120043Z-candidate-discovery-summary.json` |
| Phase 2.5 exact selected-candidate preflight | not run | `dynamic-evidence/20260419T120043Z-readonly-preflight-not-run-summary.json`; no accepted candidate existed |
| Phase 3 acceptmodv2 | not run | `dynamic-logs/20260419T120043Z-phase3-phase4-not-run.log`, `dynamic-evidence/20260419T120043Z-acceptmodv2-not-run-summary.json` |
| Phase 4 fullflow | not run | `dynamic-logs/20260419T120043Z-phase3-phase4-not-run.log`, `dynamic-evidence/20260419T120043Z-fullflow-not-run-summary.json` |

## 3. Candidate Discovery

| Candidate set | Count | Selected candidate | Phase 3 authorization |
| --- | ---: | --- | --- |
| Probe candidates `00001`-`00011` | 11 | none | no |
| Accepted candidate rows | 0 | none | no |

All probe candidates returned official patient existence `apiResult=10`; under the current harness/API/auth/parser/readiness criteria, official existence evidence therefore remained insufficient even when HTTP status was 200. This does not prove that official initial patients are absent. Insurance and appointment probes returned HTTP 403 and were classified as `ambiguous_readiness_failure`, not as proven absence of insurance or appointment data.

| Required row field | Evidence |
| --- | --- |
| `candidateId` / `source` | present in `20260419T120043Z-candidate-rows.json` |
| `officialPatientExistence.httpStatus/apiResult/apiResultAccepted/patientInformationPresent/exactIdMatched/accepted/rejectionReason` | present; accepted is false for all candidates |
| `insuranceReadiness.status/apiResult/classification/accepted` | present; HTTP 403 classified as `ambiguous_readiness_failure` |
| `appointmentDependency.flowMode/required/status/apiResult/classification/accepted` | present; direct flow mode did not convert HTTP 403 into proven appointment absence |
| `acceptedForPhase3Attempt` | boolean false for every row |

## 4. Exact Preflight

| Item | State | Evidence |
| --- | --- | --- |
| exact selected-candidate preflight script | not run | accepted candidate count was 0 |
| accepted exact preflight artifact | absent | not applicable |
| Phase 3 handoff | rejected | discovery summary declares `candidateDiscoveryAloneAuthorizesPhase3=false`; Phase 3 gate requires exact preflight artifact path/hash/runId/candidateId/input identity |

## 5. Accepted Live ORCA Claims

| Claim | Status | Evidence |
| --- | --- | --- |
| runtime-ready local stack loaded and authenticated | accepted | Phase 1 runtime-ready log/result |
| candidate discovery was read-only | accepted | `mutationPolicy.prohibited=true`, `blockedRequestCount=0` |
| official patient existence requires all-zero `apiResult` | accepted as harness behavior | static tests and candidate rows showing HTTP 200 + `apiResult=10` rejected |

## 6. Rejected Live ORCA Claims

| Claim | Verdict | Evidence |
| --- | --- | --- |
| `00001`-`00011` are mutation-ready Trial-native candidates | rejected | `acceptedCandidateCount=0`; this is a readiness/evidence failure, not proof of official initial patient absence |
| HTTP 200 alone proves ORCA business success | rejected | official patient probes with HTTP 200 / `apiResult=10` are rejected |
| HTTP 403 proves insurance or appointment absence | rejected | classified as route/auth/wrapper ambiguity |
| prior `0000001` can be reused | rejected | legacy seed remains explicit rejected candidate |
| `apiResult=60` is mutation success | rejected by policy | diagnostic no-existing-acceptance only |

## 7. Not Run / Not Verified

| Item | State | Why |
| --- | --- | --- |
| exact selected-candidate preflight | not run | no selected candidate existed |
| `qa-acceptmodv2-weborca.mjs` | not run | Phase 3 explicitly out of scope |
| `qa-fullflow-weborca.mjs` | not run | Phase 4 explicitly out of scope |
| C7 dynamic mutation request evidence | not verified | no Phase 3 mutation request was sent |
| C5/C3/C6 full live evidence | not verified | fullflow was not run |

## 8. ORCA Business Semantics

| Result | Classification | Accepted? |
| --- | --- | --- |
| patient existence HTTP 2xx + parsed ORCA body + all-zero `apiResult` + `Patient_Information` + exact `Patient_ID` | official patient exists | yes |
| patient existence HTTP 200 + `apiResult=10` | patient not found | no |
| missing/blank `apiResult` | not accepted | no |
| insurance HTTP 200 + all-zero `apiResult` + usable combination | insurance ready | yes |
| insurance `apiResult=21/23` | `business_rejected_insurance` | no |
| insurance/appointment HTTP 401/403/404/5xx or wrapper error | `ambiguous_readiness_failure` | no |
| appointment row absence in `direct_acceptance` | not a blocker by itself | n/a |
| appointment row absence in `appointment_row` | `appointment_row_missing` | no |
| acceptmodv2 diagnostic `apiResult=10` | patient not found | no |
| acceptmodv2 diagnostic `apiResult=60` | no existing acceptance diagnostic | diagnostic only |
| acceptmodv2 diagnostic `apiResult=00` | existing acceptance diagnostic | diagnostic only |
| acceptmodv2 `K1/K2/K3` | accepted with warnings only with acceptance evidence | conditional |

## 9. C7 Dynamic Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| Dynamic request capture | not verified | Phase 3 not run |
| Medical information omission/selection on mutation | not verified dynamically | no mutation request existed |
| Static C7 helper/tests | accepted | `medical-information-gate.mjs` and focused test coverage |

## 10. C5 / C3 / C6 Live Evidence

| Invariant | Live status | Notes |
| --- | --- | --- |
| C5 import/canonical readback | not verified | fullflow not run |
| C3 row-local signal isolation | Phase 1 runtime-ready only | no Phase 4 evidence |
| C6 visible storage/lock evidence | not verified | fullflow not run |

## 11. Evidence Artifact Inclusion

| Artifact | Inclusion |
| --- | --- |
| `09_dynamic_orca_trial_report.md` | included |
| `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` | included |
| `dynamic-logs/20260419T120043Z-*.log` | included |
| `dynamic-evidence/20260419T120043Z-*.json` / `.md` | included |
| raw screenshots/network dumps under `artifacts/**` | excluded |

## 12. Static Command Evidence

| Command | CWD | Exit | Log |
| --- | --- | ---: | --- |
| `npm run verify:web-guard` | `web-client` | 0 | `dynamic-logs/20260419T120043Z-static-verify-web-guard.log` |
| `npm test -- --run scripts/__tests__ src/features/reception src/features/outpatient src/features/patients src/features/charts` | `web-client` | 0 | `dynamic-logs/20260419T120043Z-static-web-test.log` |
| `npm run typecheck` | `web-client` | 0 | `dynamic-logs/20260419T120043Z-static-typecheck.log` |
| `bash -n setup-modernized-env.sh && node --check ...` | repo root | 0 | `dynamic-logs/20260419T120043Z-static-script-syntax.log` |
| `node --test tests/review-package/create-review-package.test.mjs tests/review-packet/reviewer-submission-packet.test.mjs` | repo root | 0 | `dynamic-logs/20260419T120043Z-static-review-package-tests.log` |

Server tests were not run because `server-modernized/` was not touched.

## 13. Package Integrity

| Field | Value |
| --- | --- |
| package path | `artifacts/review-bundles/OpenDolphin_WebClient-review-package-20260419T120043Z-with-dynamic-evidence.zip` |
| size bytes | `19263015` |
| sha256 | `83687c1477b3c72c4d8f1b67a4f7623c781ade3b5f7986cf6e8a8d0df488d50f` |
| integrity source | `artifacts/review-bundles/OpenDolphin_WebClient-review-package-20260419T120043Z-with-dynamic-evidence.zip.summary.txt` |

## 14. Secret Scan

| Scope | Result |
| --- | --- |
| current included dynamic logs, static logs, JSON/Markdown summaries, report, manifest, and package manifest inputs | clean: `dynamic-logs/20260419T120043Z-secret-scan.log` reports `CLEAN_NO_MATCHES` |

## 15. Remaining Blockers

| Blocker | Current state |
| --- | --- |
| no accepted Trial-native candidate | active |
| exact selected-candidate preflight | not run because no candidate existed |
| Phase 3 mutation | intentionally not run |
| Phase 4 fullflow | intentionally not run |

## 16. Next Recommendation

Do not run Phase 3 from this evidence set. Obtain or configure a Trial-native patient that passes official all-zero patient existence and insurance readiness, then rerun Phase 2.5 candidate discovery. If at least one accepted candidate exists, run exact selected-candidate preflight. Phase 3 may be scheduled only if that exact preflight artifact passes and this task's no-mutation policy is no longer in force.
