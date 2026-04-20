# Subagent prompts

All subagents used gpt-5.4 high. Each worked in a separate worktree. None ran live ORCA, acceptmodv2 mutation, Phase 4, fullflow, or raw artifact generation.

## Subagent A
```text
You are Subagent A for OpenDolphinNext ORCA Phase 3 command/sanitize remediation.
Work only in your own separate worktree: /Users/Hayato/Documents/GitHub/opendolphin-subagent-phase3-command-discovery.
Do not run live ORCA.
Do not call acceptmodv2 mutation route.
Do not patch or commit.
Do not generate raw artifacts.

Goal:
Find the existing Phase 3 / acceptmodv2 execution path and determine why it failed the no raw/browser/network artifact guard.

Inspect:
- web-client/scripts/qa-acceptmodv2-weborca.mjs
- web-client/scripts/qa-lib/acceptmodv2-business-evidence.mjs
- web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs
- related tests
- scripts/tools/README.md
- docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/*.json

Required output:
- PASS / FAIL / PARTIAL
- exact command candidates found
- exact files inspected
- whether the current command writes screenshots/videos/traces/HAR/raw network directories
- whether the current command can be constrained to candidate 00001 only
- whether it enforces exact preflight artifact path/hash/input identity
- whether it can run without Phase 4/fullflow
- whether it can run without raw/browser/network artifacts
- minimal required remediation plan
```

## Subagent B
```text
You are Subagent B for OpenDolphinNext ORCA Phase 3 command/sanitize remediation.
Work only in your own separate worktree: /Users/Hayato/Documents/GitHub/opendolphin-subagent-phase3-sanitize-contract.
Do not run live ORCA.
Do not call acceptmodv2 mutation route.
Do not patch or commit.
Do not generate raw artifacts.

Goal:
Design the sanitized Phase 3 evidence contract and no-browser/no-raw-network artifact mode.

Required design:
- no screenshots
- no videos
- no traces
- no HAR
- no raw network dump directories
- no raw ORCA request body
- no raw ORCA response body
- no raw patient detail
- no raw insurance detail
- no credentials/cookies/session/auth/CSRF
- sanitized request classification only
- sanitized response classification only
- explicit allowedMutationAttemptCount
- explicit forbiddenMutationRequestCount
- explicit phase4=not_run
- explicit fullflow=not_run
- explicit otherCandidatesMutation=not_run

Also define:
- fail-closed checks before mutation
- exact artifact hash/path/identity checks
- candidate 00001-only check
- Request_Number=01-only intended mutation check
- Request_Number=00/02/03/04 not-success and not-run checks
- package inclusion/exclusion policy

Required output:
- PASS / FAIL / PARTIAL
- proposed JSON schemas or field list
- required command flags
- required tests
- risks and stop conditions
```

## Subagent C
```text
You are Subagent C for OpenDolphinNext ORCA Phase 3 command/sanitize remediation.
Work only in your own separate worktree: /Users/Hayato/Documents/GitHub/opendolphin-subagent-phase3-tests-guard.
Do not run live ORCA.
Do not call acceptmodv2 mutation route.
Do not patch or commit.
Do not generate raw artifacts.

Goal:
Define and, if asked by main agent later, validate the test plan for the Phase 3 command/sanitize fix.

Required tests:
- command refuses to run if exact preflight artifact sha256 mismatches
- command refuses to run if candidate is not 00001
- command refuses to run if acceptedForPhase3Attempt is not strict boolean true
- command refuses to run if targetMutationRequestCount in preflight is not 0
- command refuses to run if inputIdentity hash mismatches
- command refuses to run if raw/browser/network artifact mode is enabled
- command refuses Phase 4/fullflow flags
- command refuses other candidates
- dry-run/mock mode does not call ORCA
- sanitized evidence contains no raw body, no credential, no cookie/session/auth/CSRF, no HAR/trace/video/screenshot/raw network dump paths
- Request_Number=00 is not classified as mutation success
- apiResult=60 is not classified as mutation success
- diagnostic not_run is not classified as mutation success

Required output:
- PASS / FAIL / PARTIAL
- exact test files that should be added/updated
- suggested assertions
- commands to run
- gaps that must block Phase 3 retry
```

## Subagent D
```text
You are Subagent D for OpenDolphinNext ORCA Phase 3 command/sanitize remediation.
Work only in your own separate worktree: /Users/Hayato/Documents/GitHub/opendolphin-subagent-phase3-package-auditor.
Do not run live ORCA.
Do not call acceptmodv2 mutation route.
Do not patch or commit.
Do not generate raw artifacts.

Goal:
Define final remediation package requirements.

Package must include:
- summary
- source diff summary
- subagent reports
- command/sanitize design
- test logs
- secret scan log
- package manifest
- log inclusion manifest
- artifact sha256 ledger
- final ZIP metadata validation
- final ZIP source-scope secret scan

Package must exclude:
- node_modules
- dist
- target
- coverage
- test-results
- .git
- generated raw artifacts
- old review ZIPs
- old .zip.summary.txt sidecars
- HAR
- traces
- videos
- screenshots
- raw network dumps
- raw ORCA request/response body
- raw patient/insurance detail
- credentials/cookies/sessions/auth/CSRF

Required output:
- PASS / FAIL / PARTIAL
- package checklist
- validation commands
- known risks
```

