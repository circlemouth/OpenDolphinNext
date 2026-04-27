# RWO-08B Local Exact-Match Diagnostic

RUN_ID: `20260427T135043Z`

## Result

`RWO08B_LOCAL_SYNC_PRECONDITION_BLOCKER`

The diagnostic split the previous coarse `local_exact_match_missing` blocker into sanitized local exact-match taxonomy. No live ORCA Trial mutation, Phase 3, Phase 4, fullflow, local import/sync, production ORCA, or S3/object-storage work was executed.

## Findings

- `/api/local/patients/search` is facility-scoped by the authenticated actor facility.
- The server-side local patient-id search is a prefix query, while the QA gate requires exactly one normalized exact `patientId` match.
- ORCA patient sync/import upserts by `facilityId + patientId`; no zero-padding transform was found in the reviewed sync path.
- Prior sanitized candidate evidence shows non-excluded candidates `00002` through `00011` had `localCandidateCount=0` and `exactMatchCount=0` while official patient, insurance, and appointment read-only checks were accepted.

## Candidate Taxonomy

| Candidate | Taxonomy | Local candidates | Exact matches | Meaning |
|---|---:|---:|---:|---|
| `00002` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |
| `00003` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |
| `00004` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |
| `00006` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |
| `00007` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |
| `00008` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |
| `00009` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |
| `00010` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |
| `00011` | `local_absent` | 0 | 0 | facility-scoped local row absent; sync/facility precondition unknown |

## Verification

- `npm test -- --run web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
- Node syntax checks for changed QA script modules
- Sanitized evidence review: no raw ORCA bodies, credentials, cookies, patient detail, insurance detail, screenshots, HAR, traces, videos, or raw network artifacts committed or packaged

## Claim Boundary

This evidence only classifies the RWO-08B local exact-match blocker. It does not claim a fresh fullflow target, exact selected-candidate preflight acceptance, Phase 3/Phase 4 mutation, L4 fullflow success, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.
