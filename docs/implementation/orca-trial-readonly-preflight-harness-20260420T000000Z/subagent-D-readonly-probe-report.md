# Subagent D Read-Only Probe Report

- RUN_ID: `20260420T000000Z`
- Worktree: `C:\Users\marug\Documents\GitHub\opendolphin-subagent-readonly-probe`
- Branch observed: `codex/subagent-readonly-probe-20260420`
- Target: `https://weborca-trial.orca.med.or.jp/`
- Source changes: none
- Legacy `client/` / `server/` changes: none

## What Was Run

- `node --check web-client\scripts\qa-weborca-candidate-discovery.mjs` - exit 0
- `node --check web-client\scripts\qa-weborca-readonly-preflight.mjs` - exit 0
- Local readiness checks for `5173` and `9080` - both initially closed
- Dedicated-container setup attempts using `WORKTREE_CONTAINER_SUFFIX=readonly-probe-20260420`
- Sanitized backend health check after partial startup - HTTP 200 with minimal UP body
- Sanitized server log review to classify why authentication bootstrap was blocked
- Cleanup of this run's dedicated containers, volumes, and generated runtime files

## What Was Not Run

- Read-only candidate discovery: not run
- Official patientget probes for `00001`-`00011`: not run
- Insurance readiness probes: not run
- Appointment readiness probes: not run
- Selector/local readiness probes: not run
- Exact selected-candidate preflight: not run
- Phase 3 `acceptmodv2` mutation: not run
- Phase 4 fullflow: not run
- Any live ORCA mutation request or new ORCA record write: not run

## Result

- `acceptedCandidateCount`: not available, because candidate discovery was not eligible to run.
- Exact preflight status: `not_run`.
- Phase 3/4 remain blocked.

The stop reason is environment readiness, not ORCA candidate evidence. The local harness could not obtain an authenticated context safely. Running the discovery helper in that state would have produced only local setup failure evidence, not the required parsed ORCA body evidence.

## Blockers Isolated

1. `setup-modernized-env.sh` direct Git Bash execution failed on CRLF parsing. I used a temporary LF-normalized copy and deleted it afterward.
2. The setup script resolved ORCA connection values internally, but compose interpolation required exported environment variables. Sourcing under `set -a` allowed the setup to proceed without changing source.
3. Flyway `V0300__baseline_fresh_schema.sql` failed over the imported legacy schema because an existing `d_audit_event` table did not have the `run_id` column needed by the migration's index creation.
4. After partial startup, login failed because authoritative audit chain storage was missing. That prevents the QA session bootstrap required by the read-only helpers.

No source changes were made for these blockers. They should be handled by the main agent before re-running Subagent D's live read-only probe.

## Threat And Misuse Checks

- Accidental mutation: Phase 3, Phase 4, mutation helpers, and exact preflight were not executed.
- Credential leakage: generated secret values and ORCA credentials were not written to deliverables; generated runtime files and containers were removed.
- Patient-sensitive leakage: no raw request/response dumps, HAR, screenshots, videos, or raw ORCA bodies were created.
- False existence conclusion: no conclusion was made about Trial patients `00001`-`00011`, because the official patientget evidence was not collected.

## Artifacts

- `subagent-D-readonly-probe-summary.json`
- `subagent-D-command-log.json`
- `subagent-D-dynamic-evidence-secret-scan.md`
- `subagent-D-artifact-sha256.txt`

## Residual Risk

The helper scripts passed syntax validation only. Live read-only candidate evidence still needs a clean authenticated local harness before any accepted candidate or exact selected-candidate preflight status can be trusted.