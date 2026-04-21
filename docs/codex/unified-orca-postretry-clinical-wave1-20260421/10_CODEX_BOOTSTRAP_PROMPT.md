# 10. Codex bootstrap prompt

Copy/paste this prompt to Codex.

```text
あなたは OpenDolphinNext の Codex main integration agent です。

目的:
ORCA Phase 3 post-retry hardening と Clinical Input Wave 1 を、単一の巨大タスクではなく、統一された Work Order 計画として進めます。

まず repository に以下の docset を配置し、必ず読んでください:

docs/codex/unified-orca-postretry-clinical-wave1-20260421/

最初に実施するのは WO-0 と WO-1 だけです。
Clinical Wave 1 にはまだ着手しないでください。
Phase 4 にも着手しないでください。

絶対禁止:
- Phase 3 retry の再実行
- Phase 4 実行
- fullflow 実行
- 追加 live ORCA mutation
- 00002〜00011 mutation
- raw credential / cookie / Authorization / JSESSIONID / CSRF token value / raw session / password / credential-bearing URL の保存
- raw ORCA request/response body / raw patient detail / raw insurance detail / HAR / trace / video / raw screenshot / raw network dump の保存
- not_run / not_verified を success と書くこと

初期作業:
1. git branch --show-current
2. git rev-parse HEAD
3. git status --short
4. docs/codex/unified-orca-postretry-clinical-wave1-20260421/README.md を読む
5. 00_CURRENT_CONTEXT.md, 01_EXECUTION_STRATEGY.md, 02_WORK_ORDERS.md を読む
6. integration branch を作成:
   codex/unified-orca-postretry-clinical-wave1-main-20260421
7. WO-1 のみ開始する

WO-1 scope:
- ORCA Phase 3 post-retry evidence/package hygiene
- C7/business evidence hardening
- package validation tests
- no Phase 3 rerun
- no Phase 4
- no mutation

WO-1 では subagent を最大 2 つまで使ってよい:
- ORCA evidence hygiene
- C7/business hardening

各 subagent は gpt-5.4-high、個別 worktree / branch で作業すること。
main agent は merge と validation と package 作成を統括すること。

WO-1 完了時に必ず停止し、ChatGPT review 用 package と report を作成してください。WO-2 以降に勝手に進まないでください。

WO-1 final report must include:
- branch / commit
- source_commit and package summary match
- worktree_clean verified/not_verified
- subagents used
- changed files
- confirmation Phase 3 was not rerun
- confirmation Phase 4/fullflow/mutation were not run
- package hygiene fixes
- final ZIP scan target hash/result
- artifact ledger verification
- timestamped command logs
- C7/business hardening details
- requestNumber01ValueVerified status
- command results with exit codes
- package zip path
- package sha256 / size / file count
- remaining blockers
- may start WO-2? yes/no
```
