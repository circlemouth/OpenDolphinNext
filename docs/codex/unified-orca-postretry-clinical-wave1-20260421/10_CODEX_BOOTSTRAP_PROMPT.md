# 10. Codex autonomous bootstrap prompt

Copy/paste this prompt to Codex.

```text
あなたは OpenDolphinNext の Codex main integration agent です。

目的:
OpenDolphinNext の ORCA Phase 3 post-retry hardening と Clinical Input Wave 1 を、統一された Work Order 計画として進めます。
ただし、今回実行するのは WO-0 と WO-1 だけです。
Clinical Wave 1 実装、Static/DADS recovery、Phase 4 handoff は、この実行では着手しません。

repository に配置済みの docset を必ず読んでください:

docs/codex/unified-orca-postretry-clinical-wave1-20260421/

必読ファイル:
- README.md
- 00_CURRENT_CONTEXT.md
- 01_EXECUTION_STRATEGY.md
- 02_WORK_ORDERS.md
- 03_ORCA_POSTRETRY_GATE.md
- 07_EVIDENCE_SANITIZE_POLICY.md
- 08_PACKAGE_POLICY.md
- 09_SUBAGENT_PROMPTS.md
- 12_REPORT_TEMPLATES.md
- 13_ACCEPTANCE_MATRIX.md
- 14_MAIN_AGENT_AUTONOMY_AND_STOP_POLICY.md

今回の実行範囲:
- WO-0: inventory and docset install verification
- WO-1: ORCA Phase 3 post-retry evidence/package hygiene + C7/business evidence hardening

今回の実行範囲外:
- WO-2 Static/DADS recovery
- WO-3 Clinical Wave 1 batch 1
- WO-4 Clinical Wave 1 batch 2
- WO-5 Phase 4 handoff docs

最重要禁止事項:
- Phase 3 retry を再実行しない。
- Phase 4 を実行しない。
- fullflow を実行しない。
- 追加 live ORCA mutation を実行しない。
- 00002〜00011 に mutation しない。
- Request_Number 02/03/04 を実行しない。
- alternate mutation harness を使わない。
- old mutation artifact replay をしない。
- raw credential / cookie / Authorization / JSESSIONID / CSRF token value / raw session / password / credential-bearing URL を保存しない。
- raw ORCA request/response body / raw patient detail / raw insurance detail / HAR / trace / video / raw screenshot / raw network dump を保存しない。
- not_run / not_verified を success と書かない。
- HTTP 200 alone / wrapper exit 0 alone を business success と書かない。
- apiResult=60 / Request_Number=00 を mutation success と書かない。

自律作業ルール:
- この Work Order 内の軽微な修正は確認を求めず自律修正する。
- 自律修正してよい範囲は 14_MAIN_AGENT_AUTONOMY_AND_STOP_POLICY.md の `Light self-repair allowed` に限定する。
- hard stop 条件に当たったら即停止し、blocker report を書く。
- WO-1 完了後は必ず停止し、WO-2 へ勝手に進まない。
- 判断に迷う場合は、安全側に倒し、not_verified / partial として report に残す。

初期作業:
1. git branch --show-current を記録する。
2. git rev-parse HEAD を記録する。
3. git status --short を記録する。
4. docset の存在と必読ファイルを確認する。
5. Phase 3 retry evidence directory の存在を確認する。
6. Phase 3 retry は既に実行済みであり、この task では再実行しないことを MAIN_AGENT_REPORT に明記する。
7. integration branch を作成する:
   codex/wo1-orca-postretry-hardening-20260421

WO-1 で直すこと:
1. Phase 3 retry package evidence hygiene
   - artifact-sha256.txt の存在と ledger verification
   - final ZIP summary の actual hash / size / file count 一致
   - final ZIP source-scope scan log が final ZIP hash を対象にしていること
   - command log に actual start/end timestamp があること
   - phase3ExecutionRunId / preflightIdentityRunId / childHarnessEvidenceRunId の分離
   - worktree_clean の過剰 claim 防止
   - full_source_secret_scan_claim の過剰 claim 防止
   - packageMode=extracted_review_subset の正しい扱い
2. C7/business evidence hardening
   - intendedRequestNumber01=true
   - requestNumberKeyPresent=true
   - requestNumber01ValueVerified=true
   - requestNumber02_03_04Absent=true
   - targetPatientId00001Verified=true
   - targetCandidateOnly00001=true
   - requestNumber 00/02/03/04/blank/null/object/array rejection
   - patient/candidate mismatch rejection
   - zero/multiple target mutation requests rejection
   - K3 acceptedWithWarnings only with actual registration evidence + C7 accepted
   - K3 alone / HTTP 200 alone / wrapper exit 0 alone rejection
   - apiResult=60 diagnostic rejection
   - Request_Number=00 mutation success rejection
3. Package validation tests
   - final ZIP scan target mismatch fails
   - missing artifact ledger fails
   - placeholder timestamp command log fails
   - worktree_clean overclaim fails
   - full source scan overclaim fails
   - raw/browser/network artifact inclusion fails

Subagent use:
Use at most two subagents in WO-1.
Both must use gpt-5.4-high and individual worktrees/branches.
Suggested subagents:

Subagent A: evidence/package hygiene
- worktree: ../odn-wo1-subagent-evidence-hygiene
- branch: codex/wo1-subagent-evidence-hygiene-20260421
- read 03_ORCA_POSTRETRY_GATE.md, 07_EVIDENCE_SANITIZE_POLICY.md, 08_PACKAGE_POLICY.md, 14_MAIN_AGENT_AUTONOMY_AND_STOP_POLICY.md
- do not run Phase 3/Phase 4/mutation

Subagent B: C7/business hardening
- worktree: ../odn-wo1-subagent-c7-business-hardening
- branch: codex/wo1-subagent-c7-business-hardening-20260421
- read 03_ORCA_POSTRETRY_GATE.md, 13_ACCEPTANCE_MATRIX.md, 14_MAIN_AGENT_AUTONOMY_AND_STOP_POLICY.md
- do not run Phase 3/Phase 4/mutation

Validation commands:
Run and log with command/cwd/runId/start/end/exit_code.
Use actual timestamps.

Required:
- git diff --check
- node --check for changed JS/MJS files
- bash -n for changed shell scripts
- focused Vitest / tests for:
  - phase3ApprovedCommandGuard
  - acceptmodv2IdentityGate
  - acceptmodv2BusinessEvidence
  - C7 payload gate tests, if separate
  - package validation tests
- node --test tests/review-package/create-review-package.test.mjs, if present
- artifact ledger verification
- dynamic evidence secret scan, if dynamic evidence is included
- final ZIP metadata validation
- final ZIP source-scope secret scan

Best effort within WO-1:
- npm run typecheck
- npm run build
- npm run lint
- npm run test:ci
If these fail outside WO-1 scope, do not start WO-2 fixes. Record exact failures and mark WO-2 required.
If they fail because of WO-1 changes, fix them before packaging.

Output directory:

docs/implementation/wo1-orca-postretry-hardening-20260421/

Package name:

OpenDolphin_WebClient-review-package-20260421T_WO1_orca-postretry-hardening.zip

Required outputs:
- MAIN_AGENT_REPORT.md
- FINAL_REPORT.md
- TEST_LOGS.sanitized.md
- command logs with timestamps
- subagent reports
- final-summary.sanitized.json
- final-summary.sanitized.md
- artifact-sha256.txt
- secret-scan.sanitized.txt
- REVIEW_PACKAGE_MANIFEST.txt
- REVIEW_LOG_INCLUSIONS_MANIFEST.txt
- final ZIP metadata validation log
- final ZIP source-scope secret scan log
- sidecar summary txt
- review package zip

Final report must include:
1. branch / commit
2. source_commit and package summary match
3. worktree_clean verified/not_verified
4. subagents used and worktrees
5. changed files
6. confirmation Phase 3 was not rerun
7. confirmation Phase 4/fullflow/mutation were not run
8. package hygiene fixes
9. final ZIP scan target hash/result
10. artifact ledger verification
11. timestamped command logs result
12. C7/business hardening details
13. requestNumber01ValueVerified status
14. command results with exit codes
15. residual typecheck/build/test:ci failures and whether they belong to WO-2
16. package zip path
17. package sha256 / size / file count
18. remaining blockers
19. may start WO-2? yes/no
20. next owner: ChatGPT review

Stop after WO-1 package/report creation.
Do not proceed to WO-2, Clinical Wave 1, Phase 4 handoff, Phase 4 execution, fullflow, or any mutation.
```
