# WO-7 Sanitized Test Logs

RUN_ID: `20260422T103126Z`

## Commands

| command group | result | evidence |
|---|---|---|
| Mac preflight commands 1-22 | pass | `command-log.jsonl`, `command-logs/001-sw_vers.log` through `022-git_ls_files_eol.log` |
| WO-6 ZIP existence/hash/size/count | pass | `command-logs/023-wo6_zip_exists.log` through `026-wo6_zip_count.log` |
| synthetic redaction safe ZIP scan | pass | `command-logs/027-synthetic_redaction_safe.log` |
| synthetic redaction unsafe-shaped ZIP rejection | pass; rejection confirmed without raw values | `command-logs/028-synthetic_redaction_unsafe.log` |

## Not Run

- Phase 3 retry rerun: no.
- Phase 4: `not_run`.
- fullflow: `not_run`.
- live ORCA connection test: `not_run`.
- live ORCA mutation: no.
- Request_Number `02` / `03` / `04`: `not_run`.
- patients/candidates `00002` through `00011` mutation: `not_run`.

## Safety Notes

- No raw credential/password/cookie/token/session values were recorded.
- No raw ORCA request or response bodies were recorded.
- No raw patient or insurance details were recorded.
- No HAR, trace, video, screenshot, or raw network dump was recorded.

