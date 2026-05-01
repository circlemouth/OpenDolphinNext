# Browser Verification Summary Template

RUN_ID: `<YYYYMMDDThhmmssZ>`

Verdict: `<PASS | PARTIAL | FAIL | NOT_RUN>`

## Scope

- Branch / commit: `<branch>` / `<short-sha>`
- Runtime profile: `<profile-name-or-not-run>`
- Browser mode: `<manual-no-artifact | playwright-no-artifact | not-run>`
- Live ORCA: `<not-run | read-only | approved-mutation>`
- Artifact policy: `no screenshot, no HAR, no trace, no video, no raw network dump`

## Environment

- Web client URL class: `<localhost-https | localhost-http | staging | not-run>`
- Server API class: `<local-modernized | staging-modernized | not-run>`
- ORCA credential state: `<set | unset | not-needed>` without values
- Storage profile: `<disabled | s3-compatible | not-run>`
- Sanitization reviewer: `<name-or-agent-id>`

## Browser Checklist

| ID | Result | Classification | Notes |
| --- | --- | --- | --- |
| B01 Login | `<pass/fail/not-run>` | `<status-class>` | `<safe note only>` |
| B02 Existing patient reception | `<pass/fail/not-run>` | `<status-class>` | `<safe note only>` |
| B03 patient_not_found display | `<pass/fail/not-run>` | `<status-class>` | `<safe note only>` |
| B04 Chart transition context | `<pass/fail/not-run>` | `<status-class>` | `<safe note only>` |
| B05 SOAP save | `<pass/fail/not-run>` | `<status-class>` | `<safe note only>` |
| B06 Document save | `<pass/fail/not-run>` | `<status-class>` | `<safe note only>` |
| B07 Injection input | `<pass/fail/not-run>` | `<status-class>` | `<safe note only>` |
| B08 Right dock minimize | `<pass/fail/not-run>` | `<status-class>` | `<safe note only>` |
| B09 URL / storage hygiene | `<pass/fail/not-run>` | `<finding-count-or-zero>` | `<safe note only>` |

## URL / Storage Hygiene

- URL query after flow: `<scrubbed | finding-count:N | not-run>`
- URL hash after flow: `<scrubbed | finding-count:N | not-run>`
- `localStorage` patient-sensitive key count: `<0 | N | not-run>`
- `sessionStorage` patient-sensitive key count: `<0 | N | not-run>`
- Raw values inspected and discarded: `<yes | no | not-run>`
- Raw values saved: `no`

## Commands

| Command | Result | Notes |
| --- | --- | --- |
| `<command>` | `<pass/fail/not-run>` | `<safe note only>` |

## No-Artifact Attestation

- Screenshots saved: `no`
- HAR saved: `no`
- Trace saved: `no`
- Video saved: `no`
- Raw network dump saved: `no`
- Raw ORCA body saved: `no`
- Credential / Cookie / token value saved: `no`
- Patient address / phone / insurance detail saved: `no`
- Browser failure snapshots retained: `<no | not-run>`

## Forbidden String Scan

Command:

```bash
rg -n --glob '*.md' --glob '*.json' '<pattern-set-from-runbook>' <summary-dir>
```

Result:

- Raw material findings: `<0 | N>`
- Policy wording findings: `<0 | N>`
- Remediation: `<none | sanitized-and-rerun>`

## Blockers / Residual Risk

- `<none | blocker classification with safe detail>`

## Sign-Off Boundary

- This summary does not claim production ORCA readiness unless the release runbook gates were executed and passed.
- This summary does not include raw clinical, credential, network, screenshot, HAR, trace, or video evidence.
