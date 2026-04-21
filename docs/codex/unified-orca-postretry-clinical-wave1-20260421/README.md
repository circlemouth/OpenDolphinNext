# Unified ORCA post-retry + Clinical Wave 1 workplan docset

This docset is the controlled plan for OpenDolphinNext work after ORCA Phase 3 retry.

## Current version

Autonomous Work Order version: `20260421-autonomous-v2`

Use this file first:

```text
docs/codex/unified-orca-postretry-clinical-wave1-20260421/10_CODEX_BOOTSTRAP_PROMPT.md
```

The bootstrap prompt now tells Codex to run **WO-0 and WO-1 only**, with light self-repair allowed inside WO-1 and explicit hard/soft stop conditions.

## Why Work Orders

The combined scope is too large for one undivided Codex task. The work is staged:

1. WO-0 inventory and docset verification
2. WO-1 ORCA post-retry evidence/C7 hardening
3. WO-2 static/DADS recovery
4. WO-3 Clinical Wave 1 batch 1
5. WO-4 Clinical Wave 1 batch 2
6. WO-5 Phase 4 handoff docs only

Each Work Order must stop with a review package and report. Do not silently proceed to the next Work Order.

## Universal safety rules

- Phase 3 retry has already run once for candidate `00001`; do not rerun it.
- Do not run Phase 4 in this docset unless a future explicit Phase 4 execution prompt is created and approved.
- Do not run fullflow.
- Do not run new live ORCA mutation.
- Do not save raw credentials, raw ORCA bodies, raw patient details, raw insurance details, HAR, traces, videos, screenshots, or raw network dumps.
- Do not treat `not_run` or `not_verified` as success.

## New autonomy policy

Read:

```text
14_MAIN_AGENT_AUTONOMY_AND_STOP_POLICY.md
```

It defines:

- light self-repair allowed inside the active Work Order
- changes that require stopping instead of self-repair
- hard stop conditions
- soft stop conditions
- subagent limits
- required report fields
