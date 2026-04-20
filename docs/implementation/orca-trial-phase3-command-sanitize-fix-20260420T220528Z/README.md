# ORCA Trial Phase 3 command/sanitize fix

RUN_ID: `20260420T220528Z`

This package did not run Phase 3.
Mutation remains `not_run`.
Phase 4 remains `not_run`.
fullflow remains `not_run`.

This package only fixes and validates command/sanitize readiness for a future Phase 3 retry review. Candidate remains `00001` only. Candidates `00002`-`00011` remain forbidden for Phase 3 until separately authorized.

## Scope
- Added an approved Phase 3 command wrapper with exact preflight path/hash/input identity checks.
- Hardened the existing acceptmodv2 harness so approved mode emits sanitized evidence only.
- Added fail-closed tests for candidate, preflight, input identity, artifact mode, Phase 4/fullflow flags, and Request_Number semantics.
- Updated the tool reference and this runbook package.

## Key files
- `web-client/scripts/qa-phase3-approved-acceptmodv2.mjs`
- `web-client/scripts/qa-lib/phase3-approved-command-guard.mjs`
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs`
- `web-client/scripts/qa-lib/acceptmodv2-business-evidence.mjs`
- `web-client/scripts/__tests__/phase3ApprovedCommandGuard.test.ts`

## Evidence
- Dry-run command evidence: `dry-run-evidence/phase3-approved-command.sanitized.json`
- Test log: `TEST_LOGS.sanitized.md`
- Secret scan: `SECRET_SCAN.sanitized.txt`
- Final package manifest: `REVIEW_PACKAGE_MANIFEST.txt`
- Final package log inclusion manifest: `REVIEW_LOG_INCLUSIONS_MANIFEST.txt`
- Hash ledger: `artifact-sha256.txt`

## Previous stopped attempt
The requested evidence ZIP `OpenDolphin_WebClient-phase3-evidence-20260420T151009Z.zip` was not present under `/Users/Hayato/Documents/GitHub` during this remediation. This package treats the previous attempt as user-supplied context only:
- verdict: `STOPPED BEFORE MUTATION`
- candidate: `00001`
- mutation: `not_run`
- Phase 4: `not_run`
- fullflow: `not_run`
- stop reason: `subagent_blocker_command_auditor_timeout`
- root blocker: no approved no-raw/browser/network-artifact command was confirmed.

## UI / DADS
No UI files were changed. DADS assessment is not materially applicable for this remediation.

