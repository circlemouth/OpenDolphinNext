# Evidence Manifest

RUN_ID: `20260514T020603Z`

## Sanitized QA Evidence

| Evidence | Path |
| --- | --- |
| candidate discovery summary | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/weborca-candidate-discovery/summary.json` |
| readonly preflight summary | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/weborca-readonly-preflight/summary.json` |
| acceptmodv2 sanitized summary | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/acceptmodv2/accept-summary.sanitized.json` |
| fullflow summary | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/fullflow/summary.json` |
| fullflow steps | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/fullflow/steps.log` |
| Phase4 dry-runs | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/phase4-dry-runs/` |
| Phase4 live results | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/phase4-live/` |

## Command Results

- Web guard: passed.
- Typecheck: passed.
- Focused Vitest: passed.
- Sensitive evidence redaction guard: passed.
- runtime-ready smoke: failed before accept because no runtime-ready entry existed for the date.

## Excluded Evidence

The following were intentionally not retained:

- raw ORCA request/response body
- raw ORCA XML
- ORCA credential or Basic header
- Cookie / Authorization / JSESSIONID / CSRF
- HAR, trace, video, raw network JSON
- screenshots containing visible Trial patient identifiers

## Notes

An early Phase4 dry-run attempt used a wrong working-directory-relative payload path and was rejected before live ORCA traffic. It is not accepted evidence and is superseded by the repo-root dry-runs listed above.
