# WO-7 Credential Redaction Synthetic Rehearsal

RUN_ID: `20260422T103126Z`

## Verdict

`passed_for_synthetic_values_only`

## Scope Boundary

- Real credentials were not used.
- Raw credential/password/cookie/token/session values were not written into repo files.
- ORCA was not contacted.
- No live ORCA connection test was run.
- No raw ORCA request or response bodies were recorded.
- No raw patient detail or raw insurance detail was recorded.
- No HAR, trace, video, screenshot, or raw network dump was created.

## Rehearsal Method

Existing local package scanner `scripts/tools/scan-review-bundle.mjs` was used against temporary `/tmp` synthetic ZIP files only:

| command log | purpose | result |
|---|---|---|
| `command-logs/027-synthetic_redaction_safe.log` | confirm redacted placeholders pass scanner | pass |
| `command-logs/028-synthetic_redaction_unsafe.log` | confirm synthetic credential-shaped unsafe input is rejected without printing raw values | pass; scanner reported only rule name |

The temporary synthetic files were removed after the rehearsal and were not packaged.

## Future Evidence Rules Confirmed

Future evidence must prohibit:

- raw ORCA request bodies.
- raw ORCA response bodies.
- raw patient details.
- raw insurance details.
- raw credentials.
- raw passwords.
- cookies.
- Authorization values.
- JSESSIONID values.
- CSRF token values.
- raw sessions and tokens.
- credential-bearing URLs.
- HAR, trace, video, screenshot, and raw network dump artifacts.

Only sanitized labels, set/unset classification, status categories, hashes, counts, and command metadata may be recorded.

## Gap Closed By WO-7

WO-6 had command guard / stop policy rules, but did not itself include a synthetic redaction rehearsal artifact. WO-7 adds that rehearsal evidence as docs/package readiness evidence without changing production code.

