# Decision Log

RUN_ID: `20260422T134401Z`

| Decision | Basis | Outcome |
|---|---|---|
| Documentation-only scope preserved. | User instruction and preflight. | No production code, CWP functional code, live ORCA, fullflow, browser tests, or commit. |
| WO-8 incorporated. | WO-8 docs exist in main worktree. | Verdict `PHASE4_BLOCKED_HARNESS_OR_EVIDENCE_POLICY`; no live action. |
| Missing CWP-01 expected filename recorded. | Existence check showed `CWP01_KARTE_ORDER_PERSISTENCE_REPORT.md` missing. | Use `CWP01_INTEGRATION_GATE_REPORT.md` as equivalent available CWP-01 evidence; final verdict uses missing-input variant. |
| Clinical Wave 1 evidence level capped. | WO-3/4 and codex gate docs explicitly limit claims. | Verification labels are no stronger than local/server/component/static. |
| Phase 3 prior acceptmodv2 evidence used narrowly. | `00_CURRENT_CONTEXT.md` and Phase 3 final summary. | Only `00001 / 00001` Trial acceptmodv2 limited success is allowed. |
| Release-ready claim rejected. | Release gates, manager docs, WO-8, fullflow/browser gaps. | Release remains blocked pending multiple gates. |
| DADS used only as reference boundary. | No UI change in this task. | No current UI compliance claim. |
| Production ORCA remains a non-claim. | RUN_ID `20260423T034854Z` RWO-10/RWO-11 boundary refresh and Trial-only automation scope. | Production ORCA readiness is `not_applicable_trial_only`; no production ORCA execution is required or allowed by this automation. |
| RWO-09 static/CI evidence does not equal release GO. | RUN_ID `20260423T030122Z` passed repo-local non-S3 static/CI checks, but runtime/live/fullflow/package/owner gates remain open. | Final Trial-backed release decision remains `not_ready`. |
| Owner standing approval is present. | RUN_ID `20260423T035517Z` owner approval clarification. | Automation may continue Trial-backed non-S3 roadmap work, including WebORCA / ORCA Trial verification when a safe approved non-S3 runtime path exists; this is not production ORCA/S3 approval and not final release GO. |
