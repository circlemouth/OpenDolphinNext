# Phase 3 guard contract

## Required gates
- Approved repository command only: `web-client/scripts/qa-phase3-approved-acceptmodv2.mjs`.
- Candidate must be exactly `00001`.
- Preflight path must be exactly `docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/exact-selected-candidate-preflight.sanitized.json`.
- Preflight SHA-256 must be exactly `57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590`.
- Input identity hash must be exactly `356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a`.
- `acceptedForPhase3Attempt` must be strict boolean `true`.
- `mutationPolicy.targetMutationRequestCount` must be `0`.
- `--sanitized-evidence-only`, `--disable-browser-artifacts`, and `--phase3-only` are required.
- Exactly one execution mode is allowed: `--dry-run`, `--mock`, or `--execute-approved-mutation`.

## Forbidden gates
- Any candidate other than `00001`.
- Old acceptmodv2 mutation evidence, fullflow evidence, network directory, HAR, trace, video, screenshot, or ZIP as preflight authorization.
- `--phase4`, `--fullflow`, `--direct-curl`, `--record-har`, `--trace`, `--video`, `--screenshot`, `--raw-network`, or similar flags.
- `QA_RECORD_HAR=1`, raw network capture env, Phase 4/fullflow env, or local option injection env.

## Request_Number semantics
- `Request_Number=01`: only intended future受付登録 mutation in this Phase 3 scope.
- `Request_Number=00`: inquiry only, never mutation success.
- `Request_Number=02/03/04`: forbidden for this Phase 3 scope.
- `apiResult=60`: diagnostic no existing acceptance, never mutation success.
- HTTP 200 alone: not business success.
- `acceptedForPhase3Attempt=true`: preflight readiness only, not mutation success.
- diagnostic `not_run`: explicit not-run evidence, not mutation success.

