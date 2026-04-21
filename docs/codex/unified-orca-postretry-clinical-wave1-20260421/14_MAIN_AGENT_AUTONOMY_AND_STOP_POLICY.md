# 14. Main agent autonomy and stop policy

This file defines how the Codex main integration agent should act without repeatedly asking for confirmation, while preventing scope creep and unsafe ORCA execution.

## 1. Default operating mode

The main agent should be autonomous inside the currently assigned Work Order.

- Default target when no explicit Work Order is specified: `WO-0` then `WO-1` only.
- Do not proceed from one Work Order to the next unless the prompt explicitly authorizes that Work Order.
- Do not ask for clarification for routine implementation details. Make a conservative, production-oriented decision and document it.
- Do not promise background work. Finish the current Work Order package/report in the current run.
- Use subagents only where they reduce risk. Do not spawn broad open-ended subagents.

## 2. Light self-repair allowed

Within the active Work Order, the main agent may fix minor issues without asking for approval.

Allowed light self-repair examples:

- missing or stale artifact ledger entry
- final ZIP hash/size/count mismatch caused by package regeneration
- package manifest/log inclusion drift
- command log missing timestamp fields
- final ZIP scan targeting an old package hash
- overly broad wording such as `full source clean` when only package scan is claimed
- missing `not_run` / `not_verified` statements
- C7/business evidence unit tests missing a boundary case already required by the Work Order
- small type/test failures directly caused by the agent's own changes
- small docs/test alignment fixes inside the active Work Order
- DADS wording fixes when they follow the bundled DADS document and do not require UI redesign

## 3. Light self-repair not allowed

Stop and report instead of self-repairing when the change would exceed the active Work Order.

Stop instead of self-repairing for:

- any live ORCA mutation request
- Phase 3 retry rerun
- Phase 4 execution
- fullflow execution
- mutation for candidates `00002` through `00011`
- Request_Number `02`, `03`, or `04` execution
- broad UI redesign
- broad database migration redesign
- changing ORCA official semantics
- weakening test assertions to make failures disappear
- changing acceptance criteria without updating the relevant Work Order and report
- ignoring or deleting failing tests without a waiver
- adding raw/browser/network artifacts to pass a diagnostic
- using raw ORCA request/response body to make C7 pass

## 4. Hard stop conditions

If any of these occur, stop immediately, do not package as accepted, and write a blocker report.

1. A command would rerun Phase 3 or execute any new ORCA mutation.
2. A command would execute Phase 4 or fullflow.
3. The agent cannot prove candidate scope remains `00001` only.
4. C7 target mutation request count is zero or greater than one for a Phase 3 success claim.
5. `requestNumber01ValueVerified` cannot be derived from sanitized evidence.
6. Raw credential, cookie, Authorization, JSESSIONID, CSRF value, raw session, raw password, credential-bearing URL, raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, screenshot, or raw network dump is generated or detected.
7. Final ZIP source-scope scan fails and cannot be repaired by removing/redacting generated review artifacts.
8. Artifact hash ledger cannot be made consistent.
9. `npm run typecheck`, `npm run build`, or `npm run test:ci` fails in a way that is outside the active Work Order and cannot be cleanly waived.
10. The agent needs external approval to change task scope.

## 5. Soft stop conditions

Soft stops end the current Work Order successfully or partially and require ChatGPT/user review before continuing.

- WO-1 package/report created.
- WO-2 package/report created.
- WO-3 package/report created.
- WO-4 package/report created.
- WO-5 package/report created.
- Any residual waiver remains.
- Any package/evidence note remains non-blocking but needs reviewer confirmation.
- The main agent cannot determine whether a failure belongs to the current Work Order.

## 6. Subagent policy

- Use `gpt-5.4-high` for every subagent.
- Every subagent must work in its own worktree and branch.
- Subagents must not edit master or the main integration branch directly.
- Subagents must not execute Phase 3, Phase 4, fullflow, or mutation commands.
- In WO-1, use at most two active subagents:
  - evidence/package hygiene
  - C7/business hardening
- In later Work Orders, use at most three active subagents unless the Work Order document explicitly permits more.
- Main agent owns merge order, conflict resolution, validation, package creation, and final report.

## 7. Reporting rule

Each Work Order report must clearly say:

- what was changed
- what was tested
- what was not run
- whether Phase 3 was rerun: must be `no`
- whether Phase 4 was run: must be `no` until a future explicit approval task
- whether fullflow was run: must be `no`
- whether any new mutation was run: must be `no`
- whether package scans target the final package hash
- whether full source scan is claimed or not claimed
- whether worktree clean is verified or not verified
- whether the next Work Order may start
