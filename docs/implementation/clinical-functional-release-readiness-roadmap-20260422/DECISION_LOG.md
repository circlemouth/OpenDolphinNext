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

