# RWO-06F instruction-charge preconditions

RUN_ID: `20260427T071611Z`

## Verdict

`RWO06F_INSTRUCTION_CHARGE_PRECONDITIONS_BLOCKED_NO_LIVE`

`instractionChargeOrder` / class `130` candidate `113001810` remains no-live prepared, but live Trial mutation is blocked because the Trial disease, facility, monthly-duplicate, department, and insurance preconditions are not proven by sanitized server-derived evidence.

No live ORCA Trial mutation was executed.

## Official-source findings

Checked on 2026-04-27:

| Source | Finding used | No-live action derived |
|---|---|---|
| `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html` | `medicalmodv2` is `/api21/medicalmodv2 class=01`; `medicalgetv2` supports `class=01`/`02`/`03`; `diseasev3` is the patient disease registration API. | Keep RWO-06F to `Request_Number=01` only; use read-only/sanitized disease and medical monthly checks before any mutation. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html` | `medicalmodv2` carries `Medical_Information` rows and may include `Disease_Information`. | Candidate code existence is insufficient; disease context must be proven separately or supplied in a safe packet. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/diseasemod2.html` | `Disease_Class` includes `05` for specific disease management fee and related guidance classes. | RWO-06F needs sanitized disease-class/equivalent evidence before live. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/medicalinfo.html` | Monthly medical information can be filtered by department and insurance; insurance omission has defined behavior for certain insurance categories. | Monthly duplicate, department, and insurance context need read-only `medicalgetv2` evidence without raw rows. |
| `https://www.orca.med.or.jp/receipt/tec/api/system_daily.data/api01rv2_system01dailyv2.pdf` | System/facility management fields can affect automatic calculation and management-fee behavior. | Facility/system classification must be sanitized and server-derived before claiming readiness. |

## No-live precondition packet

| Item | Result |
|---|---|
| Workflow | `instruction-charge` |
| Entity / class | `instractionChargeOrder` / `130` |
| Payload | `web-client/qa/payloads/phase4/medicalmodv2_instruction_charge_trial_reachability_v2.json` |
| SHA-256 | `043c2a657746820a96950d6c05e2179d65040123d677a028e9ab86bc9af98858` |
| Candidate code | `113001810` |
| Wrapper dry-run | pass / no live ORCA |
| Added contract tests | pass, focused no-live precondition guard |
| Live Trial mutation | not run |
| Business success classification | `not_applicable_no_live_precondition_blocker` |

Required evidence before any future live attempt:

| Precondition | Required sanitized evidence |
|---|---|
| Disease context | disease presence plus specific management-fee disease class or equivalent, without raw disease or patient detail |
| Facility context | facility type/classification compatible with the candidate, sanitized only |
| Monthly duplicate context | `medicalgetv2` monthly read-only duplicate status, without raw medical rows |
| Department / insurance context | server-derived department and insurance readiness, without client-provided authority or raw insurance detail |

## Misuse cases

| Misuse case | Control | Result |
|---|---|---|
| Treat class-130 code existence or dry-run pass as Trial acceptance. | Precondition packet records `stopBeforeLiveUntilAllPreconditionsProven=true`; live remains `not_run`. | Mitigated. |
| Leak raw patient, disease, insurance, or ORCA body while proving billing context. | Required future checks are sanitized summaries only and explicitly forbid raw rows/details. | Mitigated. |
| Use client-provided insurance/facility/department values as authority. | Future readiness requires server-derived evidence and rejects client-provided authority. | Mitigated. |
| Reuse Request_Number `02` / `03` / `04` with the create wrapper. | Request semantics remain `Request_Number=01` and `class=01` only. | Mitigated. |

## Verification

| Check | Result |
|---|---|
| `npm --prefix web-client test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | PASS; 28 tests |
| `qa-phase4-safe-medicalmodv2.mjs --dry-run --workflow instruction-charge ...` | PASS; no live ORCA |

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [instruction-charge-v2 dry-run](instruction-charge-v2-dry-run/phase4-medicalmodv2-summary.sanitized.json)

## Claim boundary

Allowed claim: RWO-06F now has a no-live precondition packet that blocks `instractionChargeOrder/130` live Trial execution until disease, facility, monthly, department, and insurance context are proven with sanitized server-derived evidence.

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

Run current-head non-S3 static/package/security refresh for this source/evidence change, then continue with independent no-live roadmap work. Do not execute `instractionChargeOrder/130` live until all listed preconditions have sanitized proof and a current endpoint packet.
