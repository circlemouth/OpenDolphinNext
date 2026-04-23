# RWO-06 Phase4 medicalmodv2 Post-Repair Live Trial Report

RUN_ID: `20260423T120155Z`

## Scope

This run executed the fresh owner-approved, one-shot post-repair WebORCA / ORCA Trial `medicalmodv2` action through the fixed safe wrapper.

Approved action:

| Field | Value |
|---|---|
| Wrapper | `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` |
| Endpoint | `POST /api/orca/official/chart-support/medical-mod-v2` |
| Request class | `medicalmodv2` |
| Target | `00001 / 00001` |
| Payload SHA-256 | `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618` |
| Runtime profile | `orca-trial-no-object-storage` |

## Result

The approved post-repair live action was executed exactly once. The sanitized wrapper classified the result as not accepted.

| Evidence | Classification |
|---|---|
| Live Trial action | `executed_once` |
| Verdict | `live_trial_not_accepted` |
| HTTP status | `500` |
| Response classification | `transportRejected` |
| Business accepted | `false` |
| Completion evidence | none observed |

Sanitized wrapper evidence:

- `wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json`
- `wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.md`
- `live-wrapper/phase4-medicalmodv2-summary.sanitized.json`
- `live-wrapper/phase4-medicalmodv2-summary.sanitized.md`

## Preconditions and Checks

- Branch: `master`
- HEAD before this run's evidence commit: `9f8cb1b0f8aba364660cd84298f22118be7959a2`
- Registered worktrees: main worktree only.
- Starting worktree status: clean.
- Payload SHA-256 matched the approved value.
- Safe wrapper dry-run passed without live ORCA traffic.
- Focused safe-evidence test passed: `scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` (6 tests).
- `npm test` pretest guard passed:
  - `verify:no-public-secrets`
  - `verify:no-blocked-orca-route-strings`
  - `verify:no-legacy-auth-drift`
- Local backend health probe over `http://127.0.0.1:9080/openDolphin/api/health` returned HTTP `200`.
- Local backend readiness probe over `http://127.0.0.1:9080/openDolphin/api/health/readiness` returned HTTP `503`.

The first focused test command used an incorrect path relative to `npm --prefix` and returned "No test files found"; it was rerun from `web-client/` with the correct relative path and passed.

## Security Controls

Misuse cases checked before execution:

1. A second or broadened mutation could be sent by changing the target, endpoint, request number, or payload.
   - Control: wrapper command contract fixed endpoint, target `00001`, `Request_Number=01`, class code `01`, and approved payload SHA-256.
2. Raw ORCA bodies, patient/insurance details, credentials, or browser/network artifacts could be captured as evidence.
   - Control: wrapper recorded only allowlisted sanitized summary fields and explicitly disabled browser artifacts.
3. HTTP 200 or generic zero-like `Api_Result` could be overclaimed as business success.
   - Control: wrapper required endpoint-specific completion evidence; no completion evidence was observed.

## Claim Boundary

This run proves only that the approved post-repair `medicalmodv2` Trial action was attempted once through the safe wrapper and remained not accepted.

Not claimed:

- live Trial `medicalmodv2` business acceptance
- production ORCA readiness
- S3/MinIO/object-storage readiness
- attachment storage, patient image storage, or PHR export storage readiness
- fullflow success
- final Trial-backed release readiness

Credentials printed or captured: `false`.

Raw ORCA bodies, HAR, trace, video, screenshot, raw network dump, request XML, or raw response artifacts captured: `false`.

## Next Action

The one-shot post-repair live approval is consumed. Do not run another `medicalmodv2` live action without fresh owner approval. The next safe task is a no-live RWO-06 investigation of the remaining `transportRejected` outcome using sanitized evidence only.
