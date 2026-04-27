# RWO-06H additional injectable candidates

RUN_ID: `20260427T081623Z`

## Verdict

`RWO06H_ADDITIONAL_INJECTABLE_CANDIDATE_ROW_PROOF_READY_NO_LIVE`

Four additional source-backed injectable medication candidates were checked through the repaired sanitized `medicationgetv2` Request_Number `02` read-only wrapper. One candidate, `621894701`, produced row-level sanitized master proof. No live ORCA Trial mutation was executed.

## Source-backed candidates

| Medication code | Source | Sanitized read-only result |
|---|---|---|
| `620009259` | `https://medley.life/medicines/prescription/3140400A4190/` | `official_error_no_row_proof`, `masterFound=false` |
| `620004428` | `https://medley.life/medicines/prescription/4291412D1024/` | `official_error_no_row_proof`, `masterFound=false` |
| `640408131` | `https://medley.life/medicines/prescription/2391403A1025/` | `official_error_no_row_proof`, `masterFound=false` |
| `621894701` | `https://medley.life/medicines/prescription/2290400D1033/` | `row_found_with_selection_comments`, `masterFound=true` |

Official endpoint semantics checked: `https://www.orca.med.or.jp/receipt/users/tec/api/medicationgetv2.html` for `medicationgetv2` Request_Number `02`.

## No-live payload identity

Created a changed `injectionOrder` / Claim007 class `310` payload:

- Payload: `web-client/qa/payloads/phase4/medicalmodv2_injection_trial_reachability_v3.json`
- SHA-256: `6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`
- Candidate rows: `130000510`, `621894701`, `700000031`, `0085001`
- Duplicate-live checkpoint: `rwo06h:medicalmodv2:rwo06h-injection-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`

The v3 payload passed the sanitized `medicalmodv2` safe wrapper dry-run. The exact checkpoint search found no existing accepted checkpoint in sanitized evidence paths checked during this run.

## Misuse cases

| Misuse case | Control | Result |
|---|---|---|
| Promote source-page medication identity to Trial acceptance. | Source research only selects candidates; `medicationgetv2` row proof and future live packet remain separate. | Mitigated. |
| Treat read-only `masterFound=true` as business acceptance. | Summary classifies it as `readonly_master_validity_validated_not_business_acceptance`; live remains `not_run`. | Mitigated. |
| Repeat prior rejected/oral payload identity. | v3 payload has a new SHA and uses `621894701`; `620000012` is not reused as injectable success evidence. | Mitigated. |
| Leak raw ORCA body, credentials, patient, or insurance detail while probing. | Wrapper writes allowlisted classifications/hashes only and stores no raw body. | Mitigated. |

## Verification

| Check | Result |
|---|---|
| `qa-phase4-injection-master-validity.mjs --dry-run` | PASS |
| `qa-phase4-injection-master-validity.mjs --execute-readonly` for 4 candidates | PASS; one sanitized row proof |
| `qa-phase4-safe-medicalmodv2.mjs --dry-run --workflow injection` for v3 payload | PASS |
| Exact checkpoint text search for v3 key | No accepted checkpoint found; only manifest and current dry-run references |
| `jq empty` for updated JSON evidence / payload / manifest / handoff state | PASS |
| `npm --prefix web-client test -- --run scripts/__tests__/phase4MasterValidityEvidence.test.ts scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | PASS; 37 tests |
| `npm --prefix web-client run verify:web-guard` | PASS |
| `bash server-modernized/tools/ci/check-doc-links.sh` | PASS |
| `node --test tests/review-packet/reviewer-submission-packet.test.mjs` | PASS; 7 tests |
| `node --test tests/review-package/create-review-package.test.mjs` | PASS; 25 tests |
| `git diff --check` | PASS |

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [v3 dry-run summary](injection-v3-dry-run/phase4-medicalmodv2-summary.sanitized.json)
- [selected candidate read-only evidence](read-only-621894701/master-validity-readonly-summary.sanitized.json)

## Claim boundary

Allowed claim: `RWO-06H` now has a source-backed injectable candidate with sanitized `medicationgetv2` Request_Number `02` row-level proof and a no-live v3 `medicalmodv2` payload identity.

Not claimed: `injectionOrder/310` Trial business acceptance, any live mutation, Request_Number `02` / `03` / `04` mutation success, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.

## Security notes

- Credentials printed or captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance detail captured: `false`
- Diagnostic artifacts captured: `false`
- Raw artifacts committed or packaged: `false`
- Production ORCA attempted: `false`
- S3/MinIO/object-storage configuration requested or used: `false`

## Recommended next action

Prepare the `RWO-06H` duplicate-checkpoint and runtime-readiness preflight for the v3 identity. Do not run live until the endpoint packet records runtime readiness, duplicate checkpoint decision, endpoint-specific success criteria, stop conditions, and sanitized evidence policy for a single main-worker-controlled attempt.
