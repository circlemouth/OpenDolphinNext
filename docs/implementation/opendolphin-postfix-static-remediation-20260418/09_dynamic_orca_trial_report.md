# ORCA Trial Dynamic Evidence Report

- RUN_ID: `20260419T012523Z`
- Scope: Phase 3 test-data and evidence remediation for `qa-acceptmodv2-weborca`
- Verdict: `PARTIAL / TEST-DATA BLOCKER`
- Reason: no Trial-native mutation-ready patient was accepted from live read-only probes of the official Trial initial patient candidates.
- Raw sensitive fields excluded: yes

## 1. Overall Dynamic Verdict

`PARTIAL / TEST-DATA BLOCKER`

The harness is now fail-closed before Phase 3 mutation. It probes the official Trial page initial patient numbers `00001` through `00011` as candidate sources only, then requires live read-only official patient existence, insurance readiness, selector readiness, local exact selectable readiness, appointment dependency satisfaction when required, and acceptmodv2 diagnostic state before mutation.

For `20260419T012523Z`, candidate discovery found `acceptedCandidateCount=0`. Phase 3 `qa-acceptmodv2-weborca` and Phase 4 `qa-fullflow-weborca` were intentionally not run.

## 2. Phase Status

| Phase | Status | Evidence |
| --- | --- | --- |
| Phase 1 runtime-ready | accepted | `dynamic-logs/20260419T012523Z-runtime-ready-smoke.log`, `dynamic-evidence/20260419T012523Z-runtime-ready-result.json` |
| Phase 2 read-only connectivity/auth | accepted historical evidence | `dynamic-logs/20260418T220502Z-*` logs retained in manifest |
| Phase 2.5 candidate discovery | rejected / test-data blocker | `dynamic-logs/20260419T012523Z-qa-weborca-candidate-discovery.log`, `dynamic-evidence/20260419T012523Z-candidate-discovery-summary.json` |
| Phase 2.5 exact preflight | not run as exact selected-candidate preflight | no accepted candidate existed; discovery emitted `dynamic-evidence/20260419T012523Z-readonly-preflight-summary.json` with blocker state |
| Phase 3 acceptmodv2 | not run | `dynamic-logs/20260419T012523Z-phase3-phase4-not-run.log`, `dynamic-evidence/20260419T012523Z-acceptmodv2-not-run-summary.json` |
| Phase 4 fullflow | not run | `dynamic-logs/20260419T012523Z-phase3-phase4-not-run.log`, `dynamic-evidence/20260419T012523Z-fullflow-not-run-summary.json` |

## 3. Candidate Source

| Source | Probe candidates | Accepted as candidate source? | Accepted for Phase 3 attempt? | Notes |
| --- | --- | --- | --- | --- |
| Official Trial initial data page | `00001`-`00011` | yes, as probe inputs only | no | Official page data is not treated as current live availability because Trial data may reset. |
| Explicit rejected legacy value | `0000001` | no | no | Previous Phase 3 returned `apiResult=10`; this value is not reused as an accepted candidate. |

| Candidate set | Count | Selected candidate |
| --- | ---: | --- |
| Probed Trial candidates | 11 | none |
| `acceptedForPhase3Attempt=true` | 0 | none |

Per-candidate summary is included in `dynamic-evidence/20260419T012523Z-candidate-rows.json`. All `00001`-`00011` candidates were rejected because official exact patient existence was not accepted; insurance readiness also returned rejected readiness for each candidate. Local selector exact match was accepted only for `00001`; `00002`-`00011` were rejected as local exact-match missing and were not promoted by local-only selectable rows.

## 4. Accepted Live ORCA Claims

| Claim | Status | Evidence |
| --- | --- | --- |
| Runtime UI can load authenticated local paired stack and select the smoke appointment row | accepted | Phase 1 runtime-ready result: row resolution `encounterKey`, visible row count `2`, active tab `予約`, selected date `2026-04-19` |
| Read-only ORCA connectivity/auth from prior accepted run | accepted historical evidence | medical-information route HTTP 200 / `apiResult=00`; system/master and appointment read-only evidence retained in prior logs |
| Candidate discovery performed no mutation | accepted | `mutationPolicy.prohibited=true`, `blockedRequestCount=0` |

## 5. Rejected Live ORCA Claims

| Claim | Verdict | Evidence |
| --- | --- | --- |
| `00001`-`00011` are mutation-ready Trial-native candidates | rejected | `acceptedCandidateCount=0`, official exact patient existence rejected for every candidate |
| Prior `0000001` Phase 3 attempt was a live mutation success | rejected | Prior evidence retained only as rejected Phase 3: HTTP 200 / `apiResult=10` / patient not found |
| `apiResult=60` is a mutation success | rejected by parser policy | Classified as `diagnosticNoExistingAcceptance`, not a mutation success |

## 6. Not Run / Not Verified

| Item | State | Why |
| --- | --- | --- |
| Exact selected-candidate preflight | not run | No selected candidate existed after discovery. |
| Phase 3 acceptmodv2 mutation | not run | No `acceptedForPhase3Attempt=true` candidate. |
| Phase 4 fullflow | not run | Phase 3 business accepted condition was not met. |
| C5 live import full success | not verified | Fullflow was not executed. |
| C3/C6 live row-local / visible lock evidence | not verified beyond Phase 1 runtime-ready | Fullflow was not executed. |

## 7. acceptmodv2 Business Semantics

Endpoint-specific acceptmodv2 semantics are implemented separately from generic all-zero ORCA parsing.

| apiResult / code | Classification | Accepted? | Why | Parser evidence |
| --- | --- | --- | --- | --- |
| `00` with acceptance evidence | `businessAccepted` | yes | Accepted only when response includes registration evidence such as `Acceptance_Info` / `Acceptance_Id` / patient evidence. | `web-client/src/features/reception/acceptmodv2Result.ts`, `web-client/scripts/qa-lib/acceptmodv2-business-evidence.mjs` |
| `K1` / `K2` / `K3` with acceptance evidence | `businessAcceptedWithWarnings` | yes with warnings | Official API may return warning-coded responses; warning code alone is insufficient without acceptance evidence. | parser tests in `web-client/src/features/reception/__tests__/acceptmodv2.test.ts` and `web-client/scripts/__tests__/acceptmodv2BusinessEvidence.test.ts` |
| `K1` / `K2` / `K3` without acceptance evidence | `notVerified` / not accepted | no | Warning code without registration evidence is not promoted to success. | focused helper test added |
| `10` | `businessRejected` | no | Patient not found. HTTP 200 does not override business rejection. | parser and QA harness |
| `60` | `diagnosticNoExistingAcceptance` | no | Read-only diagnostic/no existing acceptance state; not a mutation success. | parser and QA harness |
| Message-only success text | not accepted by itself | no | `Api_Result_Message` alone is not authoritative. | parser policy |

## 8. C7 Evidence

| Gate | Status | targetMutationRequestCount | checkedRequests | violationCount | Artifact |
| --- | --- | ---: | ---: | ---: | --- |
| Static field-presence gate | accepted | n/a | n/a | n/a | `web-client/scripts/qa-lib/medical-information-gate.mjs`, tests |
| Dynamic target request capture | not run | 0 | 0 | n/a | `dynamic-evidence/20260419T012523Z-acceptmodv2-not-run-summary.json` |
| Dynamic C7 accepted | not verified | 0 | 0 | n/a | No Phase 3 mutation was allowed because no candidate passed preflight. |

C7 remains fail-closed: an unspecified run must not include `medicalInformation` / `Medical_Information` fields in a target mutation body. Dynamic C7 cannot be accepted for this run because there was no target mutation request capture.

## 9. C5 / C3 / C6 Evidence

| Invariant | Live evidence status | Notes |
| --- | --- | --- |
| C5 import full success | not verified | No fullflow. MSW/local tests are not live ORCA evidence. |
| C3 row-local signal isolation | partially covered by Phase 1 only | Phase 1 confirms row selection on the runtime-ready smoke route; fullflow-specific evidence remains not verified. |
| C6 ORCA storage visible lock | not verified | Fullflow not run. |

## 10. Evidence Artifact Inclusion

| Artifact | Inclusion |
| --- | --- |
| `09_dynamic_orca_trial_report.md` | included |
| `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` | included |
| `dynamic-logs/20260419T012523Z-*.log` | included |
| `dynamic-evidence/20260419T012523Z-*.json` / `.md` | included |
| Prior Phase 2 logs | included as historical accepted read-only evidence |
| Raw screenshots under `artifacts/**` | excluded |
| Raw network dumps under `artifacts/**` | excluded |

## 11. Secret Scan

| Scope | Command | Result |
| --- | --- | --- |
| Included dynamic logs, static logs, JSON/Markdown summaries, reports, manifest | `rg --pcre2` risky raw credential / session / patient-detail patterns over package inclusion paths | clean: `dynamic-logs/20260419T012523Z-secret-scan.log` reports `CLEAN_NO_MATCHES` |

## 12. Remaining Blockers

| Blocker | Current state |
| --- | --- |
| no accepted Trial-native candidate | active |
| official patient missing | active for `00001`-`00011` live probes |
| insurance missing | active/rejected readiness for `00001`-`00011` probes |
| selector missing | not primary; selectors were available for `00001`, while `00002`-`00011` stopped before selector acceptance because local exact match was missing |
| local selectable missing | active for `00002`-`00011`; local selector alone is no longer sufficient |
| apiResult business rejected | prior `0000001` rejected evidence retained; no current Phase 3 run |
| test harness issue | not active |
| environment issue | not active for local stack; Trial data remains external test-data blocker |

## 13. Final Recommendation

- Static fix needed: no known reopen from this run.
- Harness fix needed: no; candidate discovery, identity gate, DOM injection prohibition, business semantics, and sanitized evidence artifacts are implemented.
- Test-data investigation needed: yes. Obtain a current Trial-native patient that passes official exact existence and insurance readiness, or sync local selector data to a verified official patient without mutation.
- Ready for Phase 3: no, blocked by test data.
- Ready for Phase 4: no, Phase 4 must wait until Phase 3 businessAccepted or businessAcceptedWithWarnings with C7 request capture.

## Package

Final review package metadata is reported by the worker after package creation. The support zip does not include `.git` and does not claim clean checkout truth; package SHA-256 is kept outside the zip to avoid self-referential hash drift.
