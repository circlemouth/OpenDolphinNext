# ORCA Trial read-only preflight harness hardening

RUN_ID: `20260419T220346Z`

このディレクトリは ORCA Trial Phase 2.5 exact preflight harness hardening と read-only investigation の prompt / worker report / sanitized evidence / review package manifest を保持する。

## 結論
- ORCA 公式初期患者 `00001`〜`00011` は存在する前提で扱った。
- candidate discovery の acceptedCandidateCount は `0 / 11`。
- これは「公式初期患者が存在しない」という意味ではなく、current read-only mutation-ready evidence が harness / endpoint / auth / parser / readiness / exact preflight criteria のいずれかで不足しているという意味。
- exact selected-candidate preflight は `acceptedCandidateCount=0` のため未実行。
- Phase 3 / Phase 4 / fullflow / mutation は未実行。

## Evidence
- [FINAL_REPORT.md](FINAL_REPORT.md)
- [REVIEW_LOG_INCLUSIONS_MANIFEST.txt](REVIEW_LOG_INCLUSIONS_MANIFEST.txt)
- [subagent-prompts/](subagent-prompts/)
- [subagent-reports/](subagent-reports/)
- [dynamic-evidence/readonly-investigation-summary.md](dynamic-evidence/readonly-investigation-summary.md)
- [dynamic-evidence/readonly-investigation-summary.sanitized.json](dynamic-evidence/readonly-investigation-summary.sanitized.json)
- [dynamic-evidence/readonly-investigation-command-log.md](dynamic-evidence/readonly-investigation-command-log.md)
- [dynamic-evidence/readonly-investigation-secret-scan.sanitized.txt](dynamic-evidence/readonly-investigation-secret-scan.sanitized.txt)

## Packaging Boundary
- `packageMode=extracted_review_subset`。
- raw ORCA response body、raw network dump、HAR、screenshot、trace、video、credential/cookie/session は review package に含めない。
- package source-scope scan と full repo source scan は別 claim として扱う。
