# 【ワーカー報告】C package-sanitize-evidence-agent

- RUN_ID: `20260419T131740Z`
- Branch/worktree: `codex/package-sanitize-evidence-20260419T131740Z` / `../OpenDolphin_WebClient-package-sanitize-evidence-20260419T131740Z`
- Scope: review support package hygiene, manifest wording, dynamic evidence inclusion guard, package tests/docs.
- Explicitly not run: Phase 3, Phase 4, fullflow, live mutation, mutation scripts.
- Python: not run.
- Legacy trees: `client/` and `server/` not edited.

## 実施内容

- `scripts/create-review-package.sh` を hardened:
  - Manifest/sidecar に `packageMode=extracted_review_subset` を出力。
  - `.git` 非存在の extracted subset でも package 生成可能にし、`source_commit` / `source_branch` / `worktree_clean` / `clean_checkout_claim` を `not_verified` に固定。
  - clean checkout / full source secret scan / live ORCA evidence を support zip の保証範囲から明示的に除外。
  - manifest-listed evidence を sanitized summary/report/manifest/command log に限定し、raw ORCA artifact、HAR、network/request/response、trace/video/image/XML を拒否。
  - included evidence secret scan で `Authorization`、Cookie、`JSESSIONID`、CSRF、raw session、raw password、credential-bearing URL を拒否。
  - dynamic evidence の scan claim は `dynamic_secret_scan_claim=passed`、review bundle included source-scope scan は `package_source_secret_scan_claim=passed`、full source clean は `full_source_secret_scan_claim=not_claimed` と分離。
- `tests/review-package/create-review-package.test.mjs` に extracted subset / raw artifact / credential secret scan / manifest sidecar consistency の regression を追加。
- `docs/runbooks/release-validation.md`、`scripts/tools/README.md`、Phase 2.5 dynamic report の文言を更新。

## 補正反映

`acceptedCandidateCount=0` は「公式初期患者が存在しない」という意味ではない。意味は、`00001`〜`00011` について current harness / API / auth / parser / readiness / exact-preflight criteria の read-only evidence が mutation-ready まで揃っていない、という限定に修正した。

この場合の verdict は `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` として扱う。

## Misuse Case と対策

| Misuse case | 対策 |
| --- | --- |
| `.git` を含まない support zip を clean checkout evidence と誤読する | manifest/summary に `clean_checkout_claim=not_verified`、`worktree_clean=not_verified`、non-guarantee scope を出力 |
| sanitized summary として raw ORCA artifact / network / HAR / XML を混入する | manifest-listed evidence path allowlist と raw artifact denylist で package 前に fail |
| log/evidence に credential literal や session token が混入する | included review evidence secret scan で Authorization/Cookie/JSESSIONID/CSRF/session/password/credential URL を拒否 |
| dynamic evidence scan、package source-scope scan、full repo source scan を混同する | `dynamic_secret_scan_claim=passed`、`package_source_secret_scan_claim=passed`、`full_source_secret_scan_claim=not_claimed` を manifest/sidecar/REVIEW_LOG_INCLUSIONS_MANIFEST で分離 |

## 検証結果

- `node --test tests/review-package/create-review-package.test.mjs`: PASS
- `bash -n scripts/create-review-package.sh`: PASS
- `git diff --check`: PASS

`scripts/create-review-package-curated.sh` は編集していないため、指定条件どおり構文検証対象外。

## 更新ドキュメント

- `docs/runbooks/release-validation.md`
- `docs/implementation/opendolphin-postfix-static-remediation-20260418/09_dynamic_orca_trial_report.md`
- `scripts/tools/README.md`
- 本報告書

## 残リスク

- support zip は full source secret scan を主張しない。full source clean を主張する場合は、別途 full repo/source secret scan と package-included git command logs が必要。
- 過去実行の dynamic evidence JSON は生成済み証跡として改変していない。誤読防止は docs/manifest 側で固定した。
