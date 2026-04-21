# OpenDolphinNext unified ORCA + Clinical Wave 1 docset

Version: `20260421-autonomous-v2`

Place this directory tree in the repository root. Then give Codex this prompt file:

```text
docs/codex/unified-orca-postretry-clinical-wave1-20260421/10_CODEX_BOOTSTRAP_PROMPT.md
```

This version is designed to prevent the task from becoming too broad. It authorizes only:

- WO-0 inventory/docset verification
- WO-1 ORCA Phase 3 post-retry evidence/package hygiene and C7/business hardening

It explicitly stops before:

- WO-2 static/DADS recovery
- WO-3/WO-4 Clinical Wave 1 implementation
- WO-5 Phase 4 handoff docs
- Phase 4 execution
- fullflow
- any new ORCA mutation

The autonomy and stop policy is here:

```text
docs/codex/unified-orca-postretry-clinical-wave1-20260421/14_MAIN_AGENT_AUTONOMY_AND_STOP_POLICY.md
```
