# ORCA Specification Research Package Context

RUN_ID: `20260426T212101Z`

## Purpose

This package is for external ChatGPT-assisted ORCA specification research before the next live or diagnostic Trial step. The goal is to avoid another live Trial mutation or diagnostic fullflow retry without a stronger official/public specification basis and a clear sanitized preflight plan.

## Current Repository State

- Current branch at package preparation: `master`
- Current active handoff: `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
- Current blocker: `final-owner-go-or-operator-rollback-rehearsal-pending`
- Latest non-live static refresh evidence: `docs/implementation/rwo09-non-s3-static-refresh-20260426T210142Z/`
- Production ORCA: out of scope
- S3 / MinIO / object storage: out of scope
- Raw diagnostic artifacts: local-only and not included in this package

## Why Specification Research Is Recommended

The remaining blockers are not simple syntax or static test failures. They depend on ORCA endpoint semantics, Trial master data, and business state:

- `injectionOrder/310` has a v2 no-live payload contract, but read-only Trial master-validity evidence did not validate the medication row.
- `baseChargeOrder/110` has a v2 candidate, but read-only first-visit compatibility was not validated.
- L4 fullflow has multiple prior diagnostic blockers around accept/fullflow handoff, duplicate acceptance, active row resolution, and official visit identifiers.

Before sending more live Trial mutations or repeating diagnostic fullflow, the next worker should know whether the candidate codes, request numbers, and read-only preflights match ORCA official semantics.

## Injection Blocker Summary

Evidence:

- `docs/implementation/rwo06h-injection-master-validity-readonly-20260426T140206Z/FINAL_REPORT.md`
- `docs/implementation/rwo06h-injection-master-validity-readonly-20260426T140206Z/summary.sanitized.json`

Endpoint/request class:

- Endpoint identity: `/api/orca/official/chart-support/medical-mod-v2`
- Request class: `medicalmodv2`
- Target identity: `00001`
- Payload: `web-client/qa/payloads/phase4/medicalmodv2_injection_trial_reachability_v2.json`
- Payload SHA-256: `1af0b23246e8f9ee79879b28a09888ecc719ec8f6381e2b798cd63fa020e3300`

Sanitized read-only result:

| Role | Endpoint | Code | Result |
|---|---|---|---|
| medication | `medicationgetv2` | `620000012` | `2xx` / `other_present` / `masterFound=false` |
| procedure | `masterlastupdatev3` | `130000510` | `2xx` / `success_zero` / `masterFound=true` |
| material | `masterlastupdatev3` | `700000031` | `2xx` / `success_zero` / `masterFound=true` |
| comment | `masterlastupdatev3` | `0085001` | `2xx` / `success_zero` / `masterFound=true` |

Current classification:

- `readonly_master_validity_not_validated_stop_before_live`
- No live Trial mutation was executed.

Research need:

- Confirm official row shape and code families for injection `medicalmodv2`.
- Determine whether a different medication code, lookup endpoint, or row composition should be prepared before another no-live/live step.

## Base-Charge Blocker Summary

Evidence:

- `docs/implementation/rwo06g-base-charge-first-visit-readonly-20260426T150137Z/FINAL_REPORT.md`
- `docs/implementation/rwo06g-base-charge-first-visit-readonly-20260426T150137Z/summary.sanitized.json`

Endpoint/request class:

- Read-only endpoint identity: `/api/orca11/acceptmodv2`
- Request class: `acceptmodv2_readonly_request_00`
- Target identity: `00001`
- Candidate: `baseChargeOrder` / Claim007 class `110` / code `111000110`
- Payload: `web-client/qa/payloads/phase4/medicalmodv2_base_charge_trial_reachability_v2.json`
- Payload SHA-256: `4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a`

Sanitized read-only result:

| Field | Value |
|---|---|
| HTTP status class | `2xx` |
| API result class | `nonzero_numeric` |
| Classification | `not_verified_or_not_first_visit_compatible` |
| First-visit compatible | `false` |
| Mutation success | `false` |
| Acceptance evidence present | `false` |
| Patient info present | `true` |

Current classification:

- `readonly_first_visit_not_validated_stop_before_live`
- No live Trial mutation was executed.

Research need:

- Confirm whether `Request_Number=00` is the right read-only inquiry for proving first-visit compatibility.
- Identify exactly which sanitized fields should be required before any `baseChargeOrder/110` live mutation.

## L4 Fullflow Blocker Summary

Representative evidence is under `docs/implementation/rwo08b-*`.

Important current conclusions:

- Diagnostic fullflow may be run only under the Diagnostic Artifact Exception.
- Raw screenshots, HAR, traces, videos, request XML, raw network dumps, raw request/response bodies, credentials, and patient/insurance details must remain local/untracked and must not be included in reviewer packages.
- Candidates `00001` and `00005` must not be repeated unchanged.
- Prior blockers include:
  - duplicate acceptance without canonical active row;
  - canonical Charts handoff timeout after accept;
  - missing official visit identifiers before order send;
  - target stopping before Charts handoff.

Research need:

- Determine which read-only ORCA endpoints and local server-derived fields can safely prove a fresh fullflow precondition before another diagnostic run.
- Confirm the minimum official visit identifier evidence needed to allow Charts order send without fabricating identifiers client-side.

## Requested Research Output

The attached prompt asks ChatGPT to produce:

- source-backed official/public ORCA findings;
- a distinction between spec facts, Trial observations, and hypotheses;
- next no-live/read-only Work Orders;
- unsafe actions to avoid;
- sanitized success fields and stop conditions.

## Non-Claims

This package does not claim:

- injection Trial business acceptance;
- base-charge Trial business acceptance;
- L4 fullflow success;
- final owner GO/NO-GO;
- actual rollback rehearsal;
- production ORCA readiness;
- S3/object-storage readiness;
- final release readiness.
