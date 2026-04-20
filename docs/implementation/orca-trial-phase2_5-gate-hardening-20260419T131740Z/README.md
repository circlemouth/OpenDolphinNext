# ORCA Trial Phase 2.5 gate hardening

- RUN_ID: `20260419T131740Z`
- Scope: Phase 2.5 gate hardening and evidence package hygiene
- Explicitly not run: Phase 3, Phase 4, fullflow, mutation
- Main branch at start: `codex/orca-trial-preflight-evidence`

## Threat Model

Misuse cases considered before implementation:

1. Candidate discovery output is mistaken for a mutation authorization artifact.
2. HTTP 200, apiResult warning/rejection codes, or not-run evidence is misread as business success.
3. Local selectable patient evidence is substituted for official ORCA patient existence.
4. Exact preflight identity drift lets a different patient, department, physician, payment mode, visit kind, or medical-information state reach mutation.
5. Review bundles claim clean checkout or full secret cleanliness without including evidence that proves the claim.
6. Raw session, credential, cookie, Authorization, CSRF, or patient-sensitive response details leak into review artifacts.
7. Mock/test/detector/docs route references are treated as public ORCA routes.

## Subagents

| Agent | Branch | Responsibility |
| --- | --- | --- |
| A phase25-candidate-preflight-agent | `codex/phase25-candidate-preflight-20260419T131740Z` | candidate discovery/read-only preflight semantics |
| B phase3-c7-notrun-agent | `codex/phase3-c7-notrun-20260419T131740Z` | acceptmodv2 exact preflight gate, not-run and C7 semantics |
| C package-sanitize-evidence-agent | `codex/package-sanitize-evidence-20260419T131740Z` | review package metadata, secret scan, sanitized evidence inclusion |
| D docs-route-taxonomy-agent | `codex/docs-route-taxonomy-20260419T131740Z` | route taxonomy guard and docs wording alignment |

Saved prompts are in `subagent-prompts/`.

## Gate Invariants

- Candidate discovery is proposal-only.
- ORCA Trial initial patients `00001` to `00011` exist as official initial data. If no candidate is accepted, the claim is not that those official initial patients are absent; the claim is only that current read-only evidence across harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria is not sufficient for Phase 3 mutation readiness.
- Exact selected-candidate read-only preflight is the only Phase 3 handoff artifact.
- `acceptedForPhase3Attempt` must be boolean `true` to permit mutation.
- `apiResult=10` is `patient_not_found` rejection.
- `apiResult=60` is no-existing-acceptance diagnostic, not mutation success.
- `apiResult=00` with `Request_Number=00` is existing-acceptance diagnostic, not mutation success.
- Phase 3 not run and C7 not verified are not success states. C7 dynamic evidence is not verified unless target mutation request capture exists, and `targetMutationRequestCount=0` / `checkedRequests=0` must not be accepted.
- Review packages must describe whether they are extracted subsets and what they do not prove.
- `full_source_secret_scan_claim=not_claimed` must not be phrased as full clean, and `worktree_clean=not_verified` must not be phrased as clean checkout truth.
- Raw artifacts and secret-bearing values must stay out of review bundles.
