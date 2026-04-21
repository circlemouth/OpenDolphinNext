# OpenDolphinNext clinical input Wave 2A Codex docset

Purpose: fix the highest-severity Wave 1 blockers that require production implementation changes, while preserving the strict boundary that local/unit/MSW/static success is not live ORCA success.

This wave intentionally excludes:
- order set extended-field preservation policy changes
- ended disease default-visibility policy changes that need product/clinical decision
- ORCA carrier compatibility confirmation that requires official ORCA specification review
- live ORCA mutation, Phase 3, Phase 4, fullflow, reception registration mutation

Recommended merge order:
1. Agent A (server validation)
2. Agent B (server document audit)
3. Agent C (web UI + DADS)
4. Agent D (test contract flip + aggregate report)

Target branch naming convention:
- codex/wave2a-agent-a-server-validation
- codex/wave2a-agent-b-document-audit
- codex/wave2a-agent-c-web-dads-validation
- codex/wave2a-agent-d-test-reporting

Final report path:
- docs/codex/clinical-input-wave2a-20260421/results/WAVE2A_COORDINATOR_REPORT.md
