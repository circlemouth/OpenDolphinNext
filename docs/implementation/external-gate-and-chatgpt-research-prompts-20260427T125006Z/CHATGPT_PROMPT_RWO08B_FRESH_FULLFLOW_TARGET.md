# ChatGPT Research Prompt: RWO-08B fresh fullflow target blocker

You are a research-only ChatGPT agent helping the OpenDolphinNext release-readiness effort.

Your task is to investigate the `RWO-08B` blocker: no fresh/local-selectable WebORCA Trial fullflow target is currently available after excluding duplicate-blocked candidates.

## Repository / Project Context

Project: OpenDolphin WebClient modernization.

Relevant scope:

- `web-client/`
- `server-modernized/`
- roadmap docs under `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/`
- automation handoff docs under `docs/implementation/automation-handoff/`

Out of scope:

- production ORCA
- production credentials
- production patient data
- S3 / MinIO / object-storage setup
- legacy `client/` and `server/` changes
- live mutation execution
- raw ORCA request/response bodies
- credentials, cookies, sessions, Authorization headers, CSRF values
- raw patient or insurance details
- screenshots, HAR, traces, videos, raw network dumps as research evidence

## Current Known Evidence

Latest relevant run:

- RUN_ID: `20260427T121615Z`
- Evidence summary: `docs/implementation/rwo08b-readonly-candidate-refresh-20260427T121615Z/summary.sanitized.json`
- Final report: `docs/implementation/rwo08b-readonly-candidate-refresh-20260427T121615Z/FINAL_REPORT.md`
- Result: `RWO08B_READONLY_CANDIDATE_REFRESH_BLOCKED_NO_FRESH_TARGET`

Sanitized facts:

- Read-only candidate discovery source: `qa-weborca-candidate-discovery`
- Flow mode: `candidate-discovery-proposal`
- Candidate set checked: WebORCA Trial initial candidate IDs `00001` through `00011`
- Accepted proposal candidates before exclusion: `2`
- Explicitly excluded duplicate-blocked candidates: `00001`, `00005`
- Selected candidate after exclusion: `none`
- Non-excluded candidates `00002` through `00011` were rejected by sanitized classification `local_exact_match_missing`
- `candidateDiscoveryAloneAuthorizesPhase3=false`
- Exact selected-candidate preflight: `not_run`
- Phase 3: `not_run`
- Phase 4: `not_run`
- Fullflow: `not_run`
- Mutation route blocked request count: `0`
- Blocker classification: `test-data-or-harness-readiness-blocker`
- Blocker reason: `phase3_mutation_ready_readonly_evidence_missing`

Prior relevant evidence:

- `docs/implementation/rwo08b-duplicate-candidate-exhaustion-20260425T152931Z/summary.sanitized.json`
- It classified `00001` and `00005` as duplicate-acceptance / no-active-entry blockers and found no fresh local-selectable Trial candidate after excluding them.

## Research Goal

Determine what safe, no-live next action could plausibly resolve the fresh fullflow target blocker.

You are not being asked to run commands or access credentials. You are being asked to produce a research memo and recommendation.

Investigate:

1. Whether `local_exact_match_missing` likely means:
   - local seed/import is stale or incomplete;
   - WebORCA Trial patient exists but is not synchronized into local patient search;
   - the patient ID normalization or facility scoping is wrong;
   - current date / visit-date filtering hides the row;
   - the harness is too strict or selecting the wrong local-search criteria.
2. Whether a safe repo-local no-live step could improve evidence without live mutation, such as:
   - read-only local patient search diagnostics;
   - sanitized import/sync precondition check;
   - exact patientgetv2 + local search comparison with hashed/redacted evidence;
   - date/facility-scoped local search review;
   - wrapper/parser refinement to distinguish local-sync blocker from test-data blocker.
3. Whether a new ChatGPT-recommended investigation should require ORCA official docs, repo docs, or code review before any automation step.

## Required Output

Return a concise research memo with these sections:

1. `Summary`
2. `Likely Root Causes`
3. `Safe No-Live Next Actions`
4. `Evidence Needed Before Fullflow`
5. `Do Not Do`
6. `Recommended Automation Prompt or Work Order`

For each recommendation, state whether it is:

- `repo_local_no_live`
- `requires_readonly_trial_runtime`
- `requires_owner_or_operator_input`
- `out_of_scope_for_automation`

## Hard Safety Rules

Do not request, infer, print, or store credentials.

Do not ask for raw ORCA bodies, raw patient details, raw insurance details, cookies, sessions, Authorization headers, CSRF values, HAR, traces, screenshots, videos, request XML, or raw network dumps.

Do not recommend live mutation, fullflow execution, Phase 3/Phase 4 mutation, production ORCA, or S3/object-storage setup as the immediate next step.

Do not treat candidate discovery alone as fullflow or Phase 3 authorization.

Do not treat HTTP 200, dry-run success, local-search-only success, or `acceptedCandidateCount > 0` as release evidence.

The only acceptable immediate next actions are sanitized, no-live/read-only diagnostics or an explicit owner/operator blocker.

