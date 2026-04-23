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
| Non-S3 runtime profile implemented. | RUN_ID `20260423T060115Z` added `attachment.storage.mode=disabled`, setup profile `orca-trial-no-object-storage`, fail-closed storage behavior, readiness sanitization, and focused tests. | RWO-06A blocker is resolved repo-locally; live Trial `medicalmodv2` remains not run and should be the next narrow action through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`. |
| WebORCA / ORCA Trial remains the only live target. | Owner clarification during RUN_ID `20260423T080150Z` said to use the Trial server. | Trial remains the only allowed ORCA target, but live `medicalmodv2` was not sent because the approved local non-S3 runtime path still lacks required non-S3 inputs. |
| Scoped medicalmodv2 Trial acceptance recorded. | RUN_ID `20260423T150257Z` classified `apiResult=14` as stale Phase4 department/physician context, added an active Phase4 payload aligned to prior sanitized Phase3 Trial context, passed focused no-live checks, and executed one sanitized live Trial retry with `businessAccepted=true`. | RWO-06 `medicalmodv2` is accepted for target `00001`, Request_Number `01`, class `01`; this is not production ORCA, S3/object-storage, fullflow, diseasev3, subjectivesv2, Request_Number `02` / `03` / `04`, or final release readiness. |
| Current-head reviewer support package refreshed. | RUN_ID `20260423T170226Z` regenerated the review package from current `master` HEAD `2dd8343dd2c04a4659c37d01c38fe513cd21add2`, then passed regression tests, metadata validation, sha verification, source-scope secret scan, and forbidden-path scan. | Package/review-bundle evidence is current for the latest roadmap docs commit, but reviewer submission packet and final release GO/NO-GO remain open. |
