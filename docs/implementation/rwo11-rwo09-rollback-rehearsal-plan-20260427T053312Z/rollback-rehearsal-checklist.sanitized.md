# RWO-11/RWO-09 Rollback Rehearsal Checklist

RUN_ID: `20260427T053312Z`

## Scope

This checklist is the sanitized, non-production rehearsal intake for the ORCA remediation pair release. It is derived from:

- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`
- `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`

It does not execute rollback by itself. It defines the minimum inputs and stop conditions required before automation may run a safe non-production rollback rehearsal.

## Required Inputs Before Execution

| Input | Required evidence | Current status |
|---|---|---|
| Rehearsal environment | Named non-production target owned by this run; production infrastructure excluded. | Missing. |
| Restore target | Exact commit or release artifact for both `web-client` and `server-modernized`. | Missing. |
| Pair-release boundary | Confirmation that both components will be restored together. | Required by runbook; not yet tied to a target. |
| Start command | Documented command for the selected non-production target. | Ambiguous until target is selected. |
| Stop command | Documented command for the selected non-production target. | Ambiguous until target is selected. |
| Minimum restored-target smoke | Reception search/acceptance, Charts open, Patients list, Admin connection check. | Defined by runbook; not executed. |
| Evidence directory | `artifacts/orca-remediation/closeout/<RUN_ID>/rollback/` or a run-specific sanitized equivalent. | Reserved only; no raw artifacts created. |
| Operator/owner acceptance | Explicit GO / NO-GO / PENDING text or sanitized operator evidence. | Not supplied. |

## Allowed Rehearsal Evidence

- Branch, HEAD, accepted rollback target commit or artifact identifier.
- Command names and exit status.
- Restored-target smoke pass/fail classification.
- Sanitized blocker classification.
- Timestamp and executor label.
- Hashes of sanitized summaries.

## Forbidden Rehearsal Evidence

- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs.
- Raw ORCA request or response bodies.
- Raw patient or insurance detail.
- Screenshots, HAR, traces, videos, raw network dumps, request XML.
- S3, MinIO, object-storage configuration or readiness claims.
- Production ORCA execution or production rollback claims.

## Stop Conditions

Stop before execution if any of the following is true:

- the target is production or could affect production infrastructure;
- the restore target is missing or differs between `web-client` and `server-modernized`;
- the stop/start commands are not documented for the selected non-production target;
- minimum restored-target smoke cannot run without credentials or raw artifacts;
- rollback evidence would require committing or packaging raw artifacts;
- owner final decision text is absent and the task is decision recording rather than rehearsal preparation.

## Current Classification

`blocked_safety_stop_target_ambiguity`

The runbook defines rollback conditions, procedure, smoke expectations, and sanitized evidence rules, but current repo-local evidence does not name a concrete non-production rehearsal target or rollback artifact/commit pair. Executing a rehearsal from this state would be target-ambiguous, so this run stops before rollback execution and records the plan/checklist instead.
