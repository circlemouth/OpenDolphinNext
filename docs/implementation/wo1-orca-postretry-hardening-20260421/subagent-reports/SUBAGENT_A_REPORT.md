# WO-1 Subagent A Report: evidence/package hygiene

RUN_ID: `20260421T101537Z`

## Scope

- Worktree: `../odn-wo1-subagent-evidence-hygiene`
- Branch: `codex/wo1-subagent-evidence-hygiene-20260421`
- 担当: artifact ledger / package metadata / final ZIP source-scope scan / timestamped command logs / runId split / overclaim prevention / package validation tests
- 禁止事項: Phase 3 rerun、Phase 4、fullflow、mutation は実行していない。

## Threat model / misuse cases

1. 古い preliminary ZIP の hash を final ZIP scan 証跡として再利用し、package source-scope scan の成功を過大主張する。
2. `recorded_in_session_transcript` など placeholder timestamp の command log を pass evidence として同梱する。
3. `full_source_secret_scan_claim=passed` や `worktree_clean=yes` を、package-included evidence なしで主張する。
4. `artifact-sha256.txt` が欠落または stale のまま、artifact ledger verified と報告する。
5. Phase 3 実行 run、preflight identity run、child harness evidence run を単一 `runId` に潰し、証跡の出所を追えなくする。

## Implemented

- `scripts/create-review-package.sh`
  - manifest-listed `.log` / `*command-log.json` / `*command-log.jsonl` に actual UTC `start` / `end` と non-empty output evidence を必須化。
  - placeholder-only timestamp を package 生成時に拒否。
  - manifest-listed logs が既に tracked base に含まれる場合も `review_log_includes` に記録するよう修正。

- `scripts/tools/validate-review-package-metadata.mjs`
  - final ZIP hash / size / file count の既存検証を維持。
  - final ZIP source-scope scan の `target_path` / `target_sha256` が actual final ZIP と一致する検証を維持。
  - current review-log inclusion に含まれる command log の placeholder-only timestamp を package validation で拒否。
  - `full_source_secret_scan_claim=not_claimed`、`worktree_clean=not_verified`、`packageMode=extracted_review_subset` の overclaim 防止を維持。

- `scripts/tools/orca-readonly-evidence-finalizer.mjs`
  - `phase3ExecutionRunId` / `preflightIdentityRunId` / `childHarnessEvidenceRunId` を status JSON と final summary に分離して固定。
  - `command-log.jsonl` 各行に command/cwd/runId/actual UTC start/end/exit_code/output evidence を必須化。

- `scripts/tools/validate-artifact-ledger.mjs`
  - `artifact-sha256.txt` の存在、過不足、hash 一致を evidence directory 単位で検証する validator を追加。
  - evidence-relative path と repo-relative path の両形式を安全に正規化して検証。

- `scripts/tools/README.md`
  - timestamp / runId split / artifact ledger validator の運用ルールを追記。

## Verification

- `node --check scripts/tools/validate-review-package-metadata.mjs`
- `node --check scripts/tools/orca-readonly-evidence-finalizer.mjs`
- `node --check scripts/tools/validate-artifact-ledger.mjs`
- `bash -n scripts/create-review-package.sh scripts/tools/command-log-wrapper.sh`
- `node --test tests/review-package/create-review-package.test.mjs`
  - 25 tests passed。
- `node scripts/tools/validate-artifact-ledger.mjs docs/implementation/orca-trial-phase3-retry-20260421T060636Z`
  - `artifact ledger validation passed: artifact-sha256.txt entries=21`
- final ZIP source-scope scan target hash sidecar check:
  - summary `zip_sha256` と scan log `target_sha256` は `8887a2feebfe6720d82bb9dddb328391ff39514f70fbfbfdf178584aa607d4f9` で一致。

## Not run

- Phase 3 rerun: no
- Phase 4: no
- fullflow: no
- mutation: no
- live ORCA / browser / Docker startup: no
- Python: no

## Residual risks / notes

- 既存 Phase 3 retry evidence の `command-log.jsonl` / `command-log.sanitized.json` には `recorded_in_session_transcript` が残っている。実時刻を復元できないため、本作業では timestamp を捏造せず、今後の current review-log inclusion で placeholder-only timestamp を拒否する実装にした。
- Historical final ZIP binary は repo に保存されていないため、当該 ZIP の actual size/file count/hash 再計算は実施していない。今後生成する package では `validate-review-package-metadata.mjs` が actual ZIP に対して hash / size / file count を検証する。
- `worktree_clean` と `full_source_secret_scan_claim` は引き続き package evidence なしでは claim しない設計。

## Next handoff

- Main agent は、WO-1 final package 作成時に current review-log manifest へ実 timestamp 付き command logs だけを含めること。
- Artifact ledger は `node scripts/tools/validate-artifact-ledger.mjs <evidence-dir>` で package 前後に検証すること。
