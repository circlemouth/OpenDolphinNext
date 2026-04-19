【ワーカー報告】

RUN_ID: `20260419T220346Z`
Branch: `codex/orca-package-evidence-metadata-20260419T220346Z`
Worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-package-evidence-metadata-20260419T220346Z`
Commit: `4ad495bd251b54dc377bb5633e785f5cd527819b`

実施内容:
- `create-review-package.sh` で dynamic evidence scan / package source-scope scan / full source scan の claim を分離。
- `secret-scan-review-bundle.log` が pass marker と command log metadata を持つ場合のみ `package_source_secret_scan_claim=passed` を出すように変更。
- sidecar に zip count/size/hash、source commit/branch、git claim policy、scan claims を追加。
- `validate-review-package-metadata.mjs` を追加し、sidecar drift、full-source 誤 claim、source-scope scan log mismatch、raw/generated path、credential pattern を検出。
- 既存 Phase 2.5 の manifest/final report/worker report claim を現行 metadata claim に合わせて更新。

変更ファイル:
- `scripts/create-review-package.sh`
- `scripts/tools/validate-review-package-metadata.mjs`
- `scripts/tools/README.md`
- `tests/review-package/create-review-package.test.mjs`
- `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/REVIEW_LOG_INCLUSIONS_MANIFEST.txt`
- `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/FINAL_REPORT.md`
- `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/subagent-reports/C_package-sanitize-evidence-agent.md`

検証コマンドと終了コード:
- `bash -n scripts/create-review-package.sh` -> 0
- `node --check scripts/tools/validate-review-package-metadata.mjs` -> 0
- `node --test tests/review-package/create-review-package.test.mjs` -> 0, 13 tests pass
- `git diff --check` -> 0
- `/tmp` 出力で `create-review-package.sh` + `validate-review-package-metadata.mjs` + `scan-review-bundle.mjs` -> 0
  生成 zip: 2119 files, 19192675 bytes, sha256 `6dadc7afd677a718bcdd6b9aff2aac49c8fbda8b02abb3fa45dee414a638e5d6`
- `git commit -m "Harden review package metadata claims"` -> 0

未実行:
- Python は未実行。
- Phase 3 / Phase 4 / fullflow / mutation path は未実行。
- `client/` / `server/` は未変更。

ブロッカー:
- なし。worktree は commit 後 clean です。
