# RWO-09 Runtime-Ready Smoke Safe Evidence

RUN_ID: `20260423T200259Z`

## Result

`RWO09_RUNTIME_READY_SMOKE_PASS_SAFE_JSON_ONLY`

## Scope

Advance the Trial-backed non-S3 release-readiness roadmap by executing the canonical local runtime startup and `runtime-ready-smoke` on the approved `orca-trial-no-object-storage` profile, while repairing the smoke script so it no longer writes forbidden screenshot artifacts.

This run did not execute new live Trial ORCA mutation, production ORCA, S3/MinIO/object-storage setup, fullflow, HAR capture, trace capture, video capture, raw network dump capture, raw ORCA body capture, or credential capture.

## Work Performed

1. Confirmed the active automation handoff remained completed and selected independent RWO-09 runtime validation work.
2. Presence-checked approved local runtime inputs without printing values.
3. Started the paired local runtime with `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`.
4. Ran `web-client/scripts/runtime-ready-smoke.mjs` once and observed that the script still emitted PNG screenshots under `artifacts/webclient/runtime-gate-ready/<RUN_ID>/`.
5. Removed the generated local-only screenshot artifacts immediately and repaired `web-client/scripts/runtime-ready-smoke.mjs` so the script records JSON-only evidence instead of screenshots.
6. Re-ran `runtime-ready-smoke.mjs` for the same RUN_ID and confirmed the smoke passed with JSON-only output.

## Misuse Cases Checked

| Misuse case | Result |
|---|---|
| Runtime validation silently depends on S3/object-storage or dummy MinIO setup. | Blocked; the run used `orca-trial-no-object-storage`, kept storage-dependent features fail closed, and did not provision S3/MinIO values. |
| Runtime smoke writes forbidden screenshots while claiming sanitized evidence. | Fixed; screenshot writes were removed from `runtime-ready-smoke.mjs`, the unsafe local output was deleted, and the rerun retained only JSON files. |
| Browser/runtime smoke reaches blocked legacy ORCA routes or reintroduces placeholder patient context. | Blocked; blocked-route hit counters stayed at 0, Charts opened the selected encounter, and placeholder-patient warnings were absent before reload, after reload, and after start transition. |

## Verification

| Check | Result |
|---|---|
| `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` | PASS |
| `cd web-client && RUN_ID=20260423T200259Z node scripts/runtime-ready-smoke.mjs` | PASS |
| `find artifacts/webclient/runtime-gate-ready/20260423T200259Z -type f | rg '\\.(png|jpg|jpeg|har|zip|trace|webm|mp4)$|error-context\\.md|network/' -n` | PASS; zero hits |
| `rg -n "page\\.screenshot|\\.png" web-client/scripts/runtime-ready-smoke.mjs` | PASS; zero hits |

## Sanitized Runtime Evidence

- setup profile: `orca-trial-no-object-storage`
- server health: setup completed with `Server is UP!`
- API health: `api_health_check OK`
- web-client dev server: HTTPS responded for 5 consecutive checks
- runtime smoke login/session: `sessionMeStatus=200`
- selected entry resolution: `encounterKey`
- authoritative read source path: `/api/orca/official/appointments/list`
- authoritative read evidence: `recordsReturned=1`, `fallbackUsed=true`, `chartReadyEntryCount=1`
- Charts UI state: no missing-key warning, no placeholder patient label, patient label stayed resolved across reload/start
- start transition: success visible, no pause/finish requests, no bill-operation bodies
- blocked route counters: legacy queue detector `0`, legacy push-event detector `0`, invalid taxonomy detector `0`, legacy operations-readiness detector `0`
- retained artifact files: `runtime-ready-before-row-wait.json`, `runtime-ready-result.json`

The rerun remained a local runtime smoke only. It does not claim business acceptance for `appointments/list` or `visits/list`; those responses remained sanitized read-model inputs (`apiResult=21` and `apiResult=13`) while the smoke used the current fallback/read model to resolve the seeded chart-ready encounter.

## Claim Boundary

Allowed claim: the current repo can start the approved non-S3 Trial-local runtime pair and complete `runtime-ready-smoke` with JSON-only sanitized evidence and no retained forbidden artifacts.

Not claimed: production ORCA readiness, S3/object-storage readiness, attachment or PHR storage readiness, new live Trial mutation success, full prescription/order browser coverage, safe fullflow, rollback sign-off, or final release readiness.

Credentials captured: `false`
Raw artifacts captured: `false`
