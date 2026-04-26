# RWO-06G Base-Charge First-Visit Readonly Evidence

RUN_ID: `20260426T150137Z`

## Verdict

`RWO06G_READONLY_FIRST_VISIT_NOT_VALIDATED_STOP_BEFORE_LIVE`

The active rollback / owner-decision handoff remains pending because no new operator rollback rehearsal evidence and no explicit final owner GO/NO-GO/PENDING input was present in the repo. This run carried that blocker forward without reclassification and advanced the executable queue.

No live ORCA Trial mutation was executed.

## Scope

- Branch / start HEAD: `master` / `77f2d5f7ac13c2eb116c3365909d795321fbf1b6`
- Active prompt: `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
- Current Work Order: `RWO-06G`
- Endpoint identity: `/api/orca11/acceptmodv2`
- Request class: `acceptmodv2_readonly_request_00`
- Target identity: `00001`
- Base-charge payload: `web-client/qa/payloads/phase4/medicalmodv2_base_charge_trial_reachability_v2.json`
- Base-charge payload SHA-256: `4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a`
- Candidate: `baseChargeOrder` / Claim007 class `110` / code `111000110`

## Threat Model / Misuse Cases

| Misuse case | Control | Result |
|---|---|---|
| `acceptmodv2` `Request_Number=00` read-only inquiry is promoted to mutation success. | Summary records `mutationSuccess=false`, `businessAccepted=false`, and read-only-only success criteria. | Mitigated. |
| HTTP `2xx` alone is treated as first-visit compatibility or base-charge acceptance. | Wrapper requires an allowlisted diagnostic class and stops as `readonly_first_visit_not_validated` for the observed result. | Mitigated. |
| Raw ORCA XML, credentials, patient/insurance detail, or diagnostic artifacts are committed. | Wrapper writes only status classes, booleans, hashes, endpoint names, and payload identity; raw bodies are not stored. | Mitigated. |
| Production ORCA or object storage is pulled into the preflight path. | Wrapper uses only WebORCA Trial config and has no S3/object-storage dependency. | Mitigated. |

## Readonly Result

| Field | Sanitized value |
|---|---|
| HTTP status class | `2xx` |
| API result class | `nonzero_numeric` |
| Classification | `not_verified_or_not_first_visit_compatible` |
| First-visit compatible | `false` |
| Mutation success | `false` |
| Acceptance evidence present | `false` |
| Patient info present | `true` |

Because first-visit compatibility was not validated, `baseChargeOrder/110` is not ready for a live Trial mutation.

## Verification

| Check | Result |
|---|---|
| `node --check web-client/scripts/qa-lib/phase4-base-charge-first-visit-evidence.mjs && node --check web-client/scripts/qa-phase4-base-charge-first-visit.mjs` | PASS |
| `npm --prefix web-client test -- --run scripts/__tests__/phase4BaseChargeFirstVisitEvidence.test.ts` | PASS; 6 tests; web guard pretest passed |
| `qa-phase4-base-charge-first-visit.mjs --dry-run` | PASS; no ORCA network action |
| `qa-phase4-base-charge-first-visit.mjs --execute-readonly` | Expected stop before live; read-only evidence recorded |

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [base-charge-first-visit-readonly-summary.sanitized.json](../../../artifacts/orca-remediation/closeout/20260426T150137Z/qa/phase4-base-charge-first-visit-readonly/base-charge-first-visit-readonly-summary.sanitized.json)
- [base-charge-first-visit-dry-run-summary.sanitized.json](../../../artifacts/orca-remediation/closeout/20260426T150137Z/qa/phase4-base-charge-first-visit-dry-run/base-charge-first-visit-readonly-summary.sanitized.json)

## Claim Boundary

Allowed claim: `RWO-06G` now has a sanitized Trial read-only `acceptmodv2` `Request_Number=00` first-visit compatibility attempt and stops before live because the observed diagnostic was not allowlisted as first-visit compatible.

Not claimed: base-charge Trial business acceptance, `acceptmodv2` mutation success, any live mutation in this run, broad base-charge/all-order readiness, fullflow/L4 success, actual rollback rehearsal, final owner GO/NO-GO, production ORCA readiness, S3/object-storage readiness, attachment/PHR storage readiness, or final release readiness.

## Security Notes

- Credentials printed or captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance detail captured: `false`
- Diagnostic artifacts captured: `false`
- Raw artifacts committed or packaged: `false`
- Production ORCA attempted: `false`
- S3/MinIO/object-storage configuration requested or used: `false`

## Recommended Next Action

Proceed to the next independent non-live queue item, `RWO-07_OPERATION_MATRIX_HARDENING`. Do not run `baseChargeOrder/110` live until first-visit compatibility has changed evidence or a changed base-charge candidate/precondition is prepared.
