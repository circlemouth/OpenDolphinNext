# Owner Approval: Post-Repair Phase4 medicalmodv2 Live Trial Attempt

RUN_ID: `20260423T115535Z`

## Approval

The owner issued fresh explicit approval in this automation thread for one post-repair WebORCA / ORCA Trial `medicalmodv2` live attempt after the no-live repair completed in RUN_ID `20260423T110051Z`.

Approval phrase from owner:

```text
fresh owner approval は私が出した。記録してコミットして後続ワーカーが着手できるようにしておいて
```

## Approved Action

The next worker may execute exactly one additional post-repair Phase4 `medicalmodv2` WebORCA Trial action only if the approved non-S3 runtime prerequisites are available and the safe wrapper prechecks pass.

| Field | Approved value |
|---|---|
| Work Order | `RWO-06` |
| Wrapper | `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` |
| Endpoint | `POST /api/orca/official/chart-support/medical-mod-v2` |
| Request class | `medicalmodv2` |
| Target | `00001 / 00001` |
| Payload | `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json` |
| Payload SHA-256 | `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618` |
| Runtime profile | `orca-trial-no-object-storage` |
| Execution limit | exactly one post-repair live Trial action |

## Required Preconditions For The Next Worker

- Confirm branch, HEAD, `git status --short`, and registered worktrees.
- Confirm `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md` is active for this approval.
- Confirm wrapper dry-run, payload SHA-256, and safe-evidence contract checks without sending live traffic.
- Use only approved local runtime paths; never print runtime file contents or credential values.
- If approved local-only dev/Trial runtime values are missing and satisfy the automation policy, generate/store them only in an approved gitignored local runtime file without printing values.
- If ORCA Trial credentials/config are unavailable through the approved path, record `skipped_environment_unavailable_missing_runtime_secret_or_config` and do not ask for or print values.
- If S3/MinIO/object-storage configuration would be required, record `skipped_s3_required_out_of_scope` and do not provision or emulate object storage.

## Explicit Non-Scope

- Production ORCA execution or production ORCA readiness.
- S3, MinIO, object-storage credentials/configuration, dummy object storage, or object-storage readiness claims.
- Fullflow execution.
- Phase3 / `acceptmodv2` rerun.
- Request_Number `02` / `03` / `04`.
- `diseasev3` or `subjectivesv2` live execution.
- Additional patients/candidates beyond `00001 / 00001`.
- Any second post-repair `medicalmodv2` live action after the approved attempt is consumed.

## Evidence Restrictions

Allowed evidence is limited to sanitized wrapper summary, command metadata, payload SHA-256, endpoint/request-class metadata, response classification, allowlisted parsed business fields, hashes, and final verdict.

Forbidden evidence remains raw ORCA request/response bodies, raw patient or insurance details, HAR, trace, video, screenshot, raw network dump, request XML, raw network JSON, credentials, cookies, tokens, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or runtime secret file contents.

## Claim Boundary

This approval authorizes one additional post-repair Trial-backed `medicalmodv2` attempt. It is not a release GO, production ORCA approval, S3/object-storage approval, fullflow approval, or blanket approval for repeated live mutations.

## Current Status

- live Trial action in this approval record: `not_run`
- payload SHA-256 sanity check in this approval-recording run: `pass`
- credentials captured in this approval record: `false`
- raw artifacts captured in this approval record: `false`
- next worker prompt: `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
