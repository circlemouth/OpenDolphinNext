# ORCA Trial read-only preflight harness hardening

RUN_ID: `20260419T220346Z`

このディレクトリは ORCA Trial Phase 2.5 exact preflight harness hardening と read-only investigation の prompt / worker report / sanitized evidence / review package manifest を保持する。

## 結論
- ORCA Trial 公式初期患者 `00001`〜`00011` は official initial data として存在する。ただし、current evidence では mutation-ready ではない。
- candidate discovery の `acceptedCandidateCount=0` は、`00001`〜`00011` が current harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria 全体で mutation-ready read-only evidence を満たしていないという意味に限定する。
- candidate discovery は proposal-only であり、Phase 3 handoff artifact ではない。
- exact selected-candidate preflight は `acceptedCandidateCount=0` のため未実行。exact selected-candidate preflight が未実行である以上、Phase 3 / Phase 4 / fullflow / mutation は未実行。
- `acceptedForPhase3Attempt` は exact selected-candidate preflight summary 上で boolean `true` でなければならない。
- insurance / appointment の HTTP 403 は `ambiguous_readiness_failure` であり、insurance missing / appointment missing とは書かない。
- `apiResult=10` は `patient_not_found` rejection、`apiResult=60` は no-existing-acceptance diagnostic、`apiResult=00` with `Request_Number=00` は existing-acceptance diagnostic であり、いずれも mutation success ではない。
- C7 dynamic evidence は target mutation request capture がある場合だけ verified とする。`targetMutationRequestCount=0` / `checkedRequests=0` は accepted にしない。
- MSW/local/static tests は live ORCA fullflow success と混ぜない。

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
- `full_source_secret_scan_claim=not_claimed` は full clean ではない。
- `worktree_clean=not_verified` は clean checkout truth ではない。clean checkout truth は reviewer submission packet の `.git` 付き `review-checkout/` でだけ判定する。
