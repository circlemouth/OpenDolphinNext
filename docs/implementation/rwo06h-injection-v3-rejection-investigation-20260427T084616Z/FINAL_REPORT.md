# RWO-06H injection v3 rejection investigation

RUN_ID: `20260427T084616Z`

## Verdict

`RWO06H_INJECTION_V3_REJECTION_INVESTIGATED_NO_LIVE_CHANGED_PRECONDITION_REQUIRED`

The RWO-06H v3 live rejection was investigated without a second live send. The sanitized live result was HTTP `200`, `Api_Result=90`, `businessRejected`, and no completion identifier evidence.

## Official Findings

Official source: [medicalmodv2 endpoint page](https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html).

- `medicalmodv2` `class=01` is registration for intermediate medical data.
- The endpoint processing includes patient existence, patient exclusive-use, department, physician, comment, and insurance correctness checks.
- The official error list maps `Api_Result` `90` to an other-terminal / target-in-use condition.
- Successful registration returns completion evidence such as `Medical_Uid`; the RWO-06H v3 live response did not include that evidence.

## Decision

Do not repeat the exact v3 live send unchanged. A future RWO-06H retry needs a changed precondition: sanitized proof of a fresh or lock-free target, or a changed payload/target identity with a new duplicate checkpoint and runtime preflight.

## Evidence

- [summary.sanitized.json](summary.sanitized.json)

## Claim boundary

Allowed claim: RWO-06H v3 rejection was classified as a target lock/state precondition blocker using sanitized live evidence plus official ORCA documentation.

Not claimed: injection Trial acceptance, fresh target readiness, retry readiness, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.

## Security notes

- Credentials printed or captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance detail captured: `false`
- Diagnostic artifacts captured: `false`
- Raw artifacts committed or packaged: `false`
- Production ORCA attempted: `false`
- S3/MinIO/object-storage configuration requested or used: `false`
