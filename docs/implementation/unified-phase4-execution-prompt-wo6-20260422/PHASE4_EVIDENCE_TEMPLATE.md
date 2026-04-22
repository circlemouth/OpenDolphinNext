# Phase 4 Evidence Template

This template is for a future explicitly approved Phase 4 run. WO-6 must not fill it with live ORCA evidence.

## Future Evidence Record

| field | required value |
|---|---|
| `run_id` | UTC `YYYYMMDDThhmmssZ` for the future run |
| `source_commit` | exact git commit used for execution |
| `source_branch` | branch/worktree used |
| `owner_approval_reference` | future approval message/reference, sanitized |
| `target_candidate_id` | approved target, default must be `00001` only |
| `target_patient_id` | approved target, default must be `00001` only |
| `phase3_retry_rerun` | must be `no` |
| `phase4_status` | future actual status |
| `fullflow_status` | `not_run` unless explicitly approved |
| `live_orca_mutation` | future actual status |
| `request_number_scope` | exact approved request/action |
| `sanitized_request_summary` | method/path/action/category only; no raw body |
| `sanitized_response_summary` | status/category/business result only; no raw body |
| `business_success_criteria` | endpoint-specific success criteria before execution |
| `business_success_observed` | future observed sanitized result |
| `failure_criteria` | exact conditions that make the run failed/blocked |
| `stop_conditions_triggered` | yes/no and sanitized detail |
| `command_log_metadata` | runId, cwd, sanitized_command_or_action, start_utc, end_utc, exit_code |
| `credential_handling` | set/unset classification only |
| `dynamic_secret_scan_result` | pass/fail over generated sanitized evidence |
| `final_package_summary` | repo-relative final ZIP path, size, count, sha256 |
| `source_scope_scan_result` | pass/fail and target final ZIP sha256 |
| `artifact_ledger_verification_result` | pass/fail for current sidecar directory |
| `raw_artifacts_absent` | yes/no |
| `forbidden_artifacts_absent` | yes/no; scan-confirm absence of raw ORCA request/response bodies, raw patient detail, raw insurance detail, credentials, Basic auth values, Cookie, Authorization, JSESSIONID, CSRF tokens, passwords, raw sessions/tokens, credential-bearing URLs, HAR, trace, video, screenshots, raw browser/network artifacts, and raw network dumps |
| `residual_risk` | sanitized summary |

## Business Evidence Rules

- HTTP 200 is not business success by itself.
- wrapper exit 0 is not business success by itself.
- dry-run is not mutation success.
- local/server/static tests are not live ORCA success.
- package metadata validation is not business success.
- source-scope scan pass is not full-source clean and not live ORCA success.
- `not_run`, `not_verified`, and owner-waived evidence are not success.

## Sanitized Request Summary Shape

```json
{
  "run_id": "YYYYMMDDThhmmssZ",
  "target_candidate_id": "00001",
  "target_patient_id": "00001",
  "approved_action": "<future-approved-action>",
  "request_number_scope": "<future-approved-scope>",
  "raw_request_body_stored": false,
  "credential_values_recorded": false
}
```

## Sanitized Response Summary Shape

```json
{
  "run_id": "YYYYMMDDThhmmssZ",
  "http_status_class": "2xx_or_non_2xx",
  "wrapper_exit_code": 0,
  "business_classification": "<future-business-category>",
  "business_success": false,
  "business_success_basis": "<endpoint-specific sanitized ORCA business result only; never HTTP status or wrapper exit alone>",
  "raw_response_body_stored": false,
  "raw_patient_detail_stored": false,
  "raw_insurance_detail_stored": false
}
```

## Required Final Package Evidence

Future final evidence must include:

- final ZIP summary.
- final ZIP source-scope scan log bound to the exact final ZIP path and sha256.
- metadata validation log bound to the exact final ZIP path and sha256.
- artifact ledger using repo-relative paths and unique filenames that cannot be confused with WO-5 sidecars.
- artifact ledger verification log.
- final command-log index.
- forbidden-artifact scan log over the generated evidence/package tree, with sanitized findings only and no raw matching values printed.
- final ZIP sidecars must use the current WO-6 final ZIP basename, for example `<final-zip-basename>.summary.txt`, `<final-zip-basename>.artifact-sha256.txt`, and `<final-zip-basename>.post-package-metadata-validation-final.log`.
- final sidecars must live under the current WO-6 Phase 4 package directory only; do not reuse, rename, or reference WO-5 sidecar filenames, hashes, manifests, ledgers, or scan logs as current evidence.

All evidence paths in reports, manifests, matrices, and ledgers must be repo-relative. Absolute paths may appear only in command log `cwd` values.
