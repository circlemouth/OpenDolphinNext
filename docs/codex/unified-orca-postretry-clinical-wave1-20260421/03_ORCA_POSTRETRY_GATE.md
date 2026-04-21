# 03. WO-1 ORCA post-retry evidence/C7 hardening

## Scope

WO-1 hardens the Phase 3 retry evidence and source/test guards. It does not execute Phase 3 again.

## Required source/test hardening

### Evidence/package hygiene

Required:

- `artifact-sha256.txt` exists and covers all sanitized Phase 3 retry artifacts.
- artifact ledger verification command exists and passes.
- final package summary matches actual ZIP hash/size/file count.
- final ZIP source-scope scan targets the final ZIP hash, not an older ZIP.
- command logs have actual start/end timestamps.
- distinguish:
  - `phase3ExecutionRunId`
  - `preflightIdentityRunId`
  - `childHarnessEvidenceRunId`
- `worktree_clean` is verified only if package-included git status evidence supports it.
- `full_source_secret_scan_claim` remains `not_claimed` unless full repo scan is actually run.
- package mode remains `extracted_review_subset` unless it is truly a full repository archive.

### C7/business evidence

Add or verify sanitized booleans:

```text
intendedRequestNumber01=true
requestNumberKeyPresent=true
requestNumber01ValueVerified=true
requestNumber02_03_04Absent=true
targetPatientId00001Verified=true
targetCandidateOnly00001=true
```

C7 must reject:

- requestNumber 00 / 02 / 03 / 04
- blank / null / object / array / wrong normalized value
- missing requestNumber
- patientId not 00001
- candidate not 00001
- zero mutation request captures
- more than one mutation request capture
- any case requiring raw body to decide pass/fail

Business evidence rules:

- K1/K2/K3 may be acceptedWithWarnings only with registration evidence and C7 accepted.
- K3 alone is not success.
- HTTP 200 alone is not success.
- wrapper exit 0 alone is not success.
- apiResult=60 is diagnostic, not success.
- Request_Number=00 is inquiry/existing-acceptance diagnostic, not registration success.
- Request_Number=02/03/04 are forbidden for Phase 3 retry success.

## Required tests

- C7 accepts requestNumber 01 only.
- C7 rejects 00/02/03/04.
- C7 rejects blank/null/object/array.
- C7 rejects wrong candidate/patient.
- C7 rejects zero/multiple mutation requests.
- K3 without registration evidence rejected.
- K3 with registration evidence + C7 accepted -> acceptedWithWarnings.
- apiResult=60 rejected as diagnostic.
- HTTP 200 alone rejected.
- wrapper exit 0 alone rejected.
- package validation fails on mismatched scan target hash.
- package validation fails on missing artifact ledger.
- package validation fails on placeholder-only timestamps.

## WO-1 suggested subagents

Use at most 2 subagents:

1. `orca-evidence-hygiene` — package/log/hash/scan validation
2. `c7-business-hardening` — C7/business source/tests

## WO-1 output directory

```text
docs/implementation/unified-orca-postretry-wo1-20260421/
```

## WO-1 acceptance

- Phase 3 not rerun.
- Phase 4 not run.
- no_new_mutation.
- focused ORCA tests pass.
- package validation tests pass.
- final ZIP scan targets current WO-1 ZIP hash.
- ChatGPT can review WO-1 independently.
