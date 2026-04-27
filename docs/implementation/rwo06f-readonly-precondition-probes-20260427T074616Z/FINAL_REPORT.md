# RWO-06F read-only precondition probes

RUN_ID: `20260427T074616Z`

## Verdict

`RWO06F_READONLY_PRECONDITION_PROBES_COMPLETED_STOP_BEFORE_LIVE`

RWO-06F `instractionChargeOrder` / class `130` candidate `113001810` now has a dedicated sanitized read-only probe wrapper and one WebORCA / ORCA Trial read-only execution.

The probe did not prove all required preconditions. Live `instractionChargeOrder/130` mutation remains blocked.

## Read-only Trial result

| Precondition | Classification |
|---|---|
| Disease context | `not_proven` |
| Monthly duplicate context | `not_proven` |
| Department / insurance context | `not_proven` |
| Facility context | `facility_summary_observed_sanitized` |

Observed read-only endpoints:

| Endpoint | Purpose | Result |
|---|---|---|
| `diseasegetv2` class `01` | disease-class summary | `2xx/success_zero`, but no disease row / class `05` proof |
| `medicalgetv2` class `03` | monthly duplicate / department / insurance summary | `2xx/nonzero_numeric`, no usable proof |
| `system01dailyv2` Request_Number `01` | facility/system summary | `2xx/success_zero`, sanitized fields present |
| `system01lstv2` Request_Number `04` | facility basic summary | `2xx/success_zero`, sanitized institution-code presence only |

No live ORCA Trial mutation was executed.

## Implemented wrapper

- `web-client/scripts/qa-phase4-instruction-charge-preconditions.mjs`
- `web-client/scripts/qa-lib/phase4-instruction-charge-preconditions-evidence.mjs`
- `web-client/scripts/__tests__/phase4InstructionChargePreconditionsEvidence.test.ts`

The wrapper fail-closes to WebORCA Trial, requires sanitized evidence mode and browser-artifact disablement, rejects raw artifact flags, and writes only allowlisted classifications/hashes. It does not store raw ORCA bodies, raw disease names, raw patient details, raw insurance details, credentials, cookies, sessions, Authorization headers, CSRF values, HAR, traces, videos, screenshots, or raw network artifacts.

## Misuse cases

| Misuse case | Control | Result |
|---|---|---|
| Treat a read-only HTTP `2xx` as instruction-charge business success. | Summary keeps `businessSuccessClassification=not_applicable_or_readonly_preconditions_not_proven`; live remains `not_run`. | Mitigated. |
| Leak raw disease/patient/insurance/medical rows while checking preconditions. | Sanitizer stores only counts, presence classes, booleans, and evidence hashes. | Mitigated. |
| Use client-provided department/insurance as authority. | Summary classifies department/insurance as not proven unless reflected in sanitized ORCA read-only response. | Mitigated. |
| Proceed despite partial facility proof only. | `stopBeforeLiveUntilAllPreconditionsProven=true`; live mutation remains blocked. | Mitigated. |

## Verification

| Check | Result |
|---|---|
| `npm --prefix web-client test -- --run scripts/__tests__/phase4InstructionChargePreconditionsEvidence.test.ts` | PASS; 8 tests |
| `qa-phase4-instruction-charge-preconditions.mjs --dry-run` | PASS; no read-only ORCA |
| `qa-phase4-instruction-charge-preconditions.mjs --execute-readonly` | Expected stop before live; read-only evidence recorded |

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [read-only wrapper output](../../../artifacts/orca-remediation/closeout/20260427T074616Z/qa/phase4-instruction-charge-preconditions-readonly/instruction-charge-preconditions-readonly-summary.sanitized.json)
- [dry-run wrapper output](../../../artifacts/orca-remediation/closeout/20260427T074616Z/qa/phase4-instruction-charge-preconditions-dry-run/instruction-charge-preconditions-readonly-summary.sanitized.json)

## Claim boundary

Allowed claim: RWO-06F read-only precondition probes were implemented and executed once against WebORCA / ORCA Trial with sanitized evidence only.

Not claimed: instruction-charge Trial business acceptance, all guidance-fee coverage, `diseasev3` acceptance, Request_Number `02` / `03` / `04`, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.

## Security notes

- Credentials printed or captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance/disease detail captured: `false`
- Diagnostic artifacts captured: `false`
- Raw artifacts committed or packaged: `false`
- Production ORCA attempted: `false`
- S3/MinIO/object-storage configuration requested or used: `false`

## Recommended next action

Do not execute `instractionChargeOrder/130` live. Continue independent no-live roadmap work, or create a changed RWO-06F plan that can establish disease and department/insurance context from sanitized server-derived evidence without raw patient, disease, insurance, or ORCA bodies.
