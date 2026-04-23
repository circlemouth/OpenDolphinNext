# Owner Direction: Iterative medicalmodv2 Fix-and-Retry Approval

RUN_ID: `20260423T122650Z`

## Direction

The owner explicitly allows future automation workers to repeat the RWO-06 `medicalmodv2` fix-and-retry cycle as many times as needed.

This supersedes the earlier "fresh owner approval for each additional live retry" constraint for `medicalmodv2` only.

The owner also directs the `orca` automation to proceed as autonomously as possible on this task, without waiting for additional user permission, until `medicalmodv2` is accepted or a non-skippable safety stop condition is reached.

## Allowed Iteration Pattern

Each retry cycle must follow this sequence:

1. Investigate the latest sanitized `medicalmodv2` failure without using raw ORCA bodies or forbidden browser/network artifacts.
2. Apply a repo-local fix when the root cause is testable and in scope.
3. Run focused no-live verification for the fix, including safe wrapper contract checks when relevant.
4. Re-run the approved safe `medicalmodv2` Trial wrapper only if non-S3 runtime prerequisites are available and preflight checks pass.
5. Record sanitized endpoint-specific business evidence and update the handoff state and gate matrix.
6. If still not accepted, repeat from step 1.

There is no owner-imposed maximum retry count for this `medicalmodv2` fix-and-retry loop.

Workers should not stop at a proposal. If a repo-local, testable fix is available within scope, implement it, verify it, run the safe retry when prerequisites pass, record the sanitized result, and continue the loop in the same run when time and safety constraints allow.

## Boundaries That Still Apply

This direction does not authorize:

- production ORCA execution or production ORCA readiness claims
- S3/MinIO/object-storage setup, credentials, emulation, or readiness claims
- Phase3 / `acceptmodv2` reruns unless separately approved
- Request_Number `02` / `03` / `04`
- `diseasev3` or `subjectivesv2` live execution
- fullflow execution
- patients/candidates outside the active handoff target unless separately approved
- raw ORCA request/response body capture
- raw patient or insurance detail capture
- credentials, cookies, sessions, Authorization headers, CSRF values, or credential-bearing URL capture
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts
- unrelated broad refactors or legacy `client/` / `server/` changes

## Claim Boundary

Repeated retry permission is not a release GO and is not evidence of live business success. Each run must still classify success from sanitized endpoint-specific completion evidence. HTTP 200, wrapper exit 0, dry-run, not-run, or generic zero-like `Api_Result` alone remains insufficient.
