# CWP-01 karte/order persistence evidence docset

RUN_ID: `20260421T062850Z`

## Purpose

This docset is the evidence skeleton for CWP-01 karte/order persistence verification.

CWP-01 is scoped to local chart / karte document persistence and local order persistence tests. It is not evidence of ORCA `medicalmodv2` live mutation success, and it must not be reported as Phase 3, Phase 4, fullflow, reception registration, or live ORCA mutation success.

The final test result is owned by the main integration pass. Any result not produced in this Worker D worktree is recorded as `main integrationで確定`.

## Verified Scope

Worker D verified only the documentation structure and index wiring for this evidence skeleton.

| Area | Status | Notes |
|---|---|---|
| Evidence docset directory | Worker D docs-only | This README defines the boundary and reporting template. |
| `docs/codex/README.md` index | Worker D docs-only | Link added for the CWP-01 evidence docset. |
| `docs/README.md` index | Worker D docs-only | Link added under Workflow Docs. |
| Local chart / karte document persistence tests | main integrationで確定 | Worker D did not run or claim application test success. |
| Local order persistence tests | main integrationで確定 | Worker D did not run or claim application test success. |
| Runtime / Playwright / e2e evidence | main integrationで確定 | Worker D did not run runtime, Playwright, e2e, Phase 3, Phase 4, or fullflow. |
| ORCA `medicalmodv2` live mutation | Out of scope | No live ORCA mutation is allowed or claimed by CWP-01. |

## Explicit ORCA Boundary

CWP-01 evidence may support only these claims:

- local chart / karte document persistence behavior was tested
- local order persistence behavior was tested
- server and/or web behavior remained inside local persistence boundaries
- ORCA mutation was not required for the CWP-01 pass/fail decision

CWP-01 evidence must not support these claims:

- ORCA `medicalmodv2` live mutation succeeded
- ORCA Trial or production ORCA accepted a medical order mutation
- Phase 3, Phase 4, fullflow, reception registration, or live mutation completed
- local test success proves ORCA carrier compatibility

If later work needs ORCA live mutation evidence, it must be a separate work package with explicit authorization, isolated credentials handling, and a dedicated evidence policy.

## Prohibited Evidence

Do not place the following in this docset, reviewer packages, logs, summaries, or generated artifacts:

- raw HAR files
- raw browser traces
- raw videos
- raw screenshots
- credentials, tokens, cookies, Basic auth values, session IDs, or secret material
- unredacted request / response bodies that contain patient information or secret-bearing headers
- live ORCA mutation evidence or mutation payloads
- external web lookup output

Allowed evidence is limited to sanitized command summaries, exit codes, bounded test output excerpts without secrets or patient identifiers, and human-written conclusions that distinguish local persistence from ORCA mutation.

## Targeted Command Table Template

The main integration agent should replace `main integrationで確定` with the exact command and result after merging the CWP-01 implementation work. Do not pre-fill success for commands that were not run.

| Target | Command | Purpose | Expected boundary | Result |
|---|---|---|---|---|
| Server local karte/document persistence | main integrationで確定 | Verify chart / karte document persistence and readback. | Local persistence only; no ORCA live mutation. | main integrationで確定 |
| Server local order persistence | main integrationで確定 | Verify order payload persistence and readback. | Local persistence only; no ORCA `medicalmodv2` success claim. | main integrationで確定 |
| Web/local contract tests, if applicable | main integrationで確定 | Verify UI or client contract does not overclaim ORCA success. | Client behavior is UX/contract evidence only. | main integrationで確定 |
| Documentation link/check | main integrationで確定 | Confirm docset and index links resolve after integration. | Docs-only check; no runtime claim. | main integrationで確定 |

## PASS / PARTIAL / BLOCKED Criteria

PASS may be recorded only when all of the following are true:

- targeted local chart / karte document persistence tests pass
- targeted local order persistence tests pass
- sanitized evidence includes exact commands and exit codes
- no prohibited evidence is included
- the report explicitly says CWP-01 is not ORCA `medicalmodv2` live mutation success
- any runtime, Playwright, e2e, Phase 3, Phase 4, or fullflow claims are either absent or backed by separately authorized evidence

PARTIAL may be recorded when:

- at least one targeted local persistence path was verified, and any failed or skipped path is identified
- the report keeps local persistence evidence separate from ORCA mutation evidence
- no prohibited evidence is included
- remaining final status is marked `main integrationで確定` or described as an unresolved integration item

BLOCKED must be recorded when:

- targeted tests cannot be run in the main integration environment
- required implementation work is missing or conflicts after merge
- evidence would require prohibited raw artifacts or secrets to support the claim
- the only available proof would be live ORCA mutation, Phase 3, Phase 4, or fullflow evidence outside the authorized scope

## Misuse Cases Covered By This Skeleton

- A reviewer reads local persistence test output as proof of ORCA `medicalmodv2` live mutation success.
- A packaging step includes raw HAR, trace, video, screenshot, credentials, cookies, or secrets.
- A worker records unrun Playwright, e2e, runtime, Phase 3, Phase 4, or fullflow success as if it had been executed.

## Next Work Package

The main integration package should:

1. Merge the CWP-01 implementation and evidence work without reverting other workers' changes.
2. Run the targeted local chart / karte document and order persistence commands.
3. Record exact commands, exit codes, and sanitized result summaries in this docset or the integration report.
4. Confirm no raw HAR, trace, video, screenshot, credentials, or secrets are included in generated artifacts.
5. Produce the final artifact zip only after integration, using sanitized evidence and preserving the ORCA boundary.
