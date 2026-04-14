# Non-Doc Structural Findings

## Summary

このタスクでは non-doc 本体は変更していない。以下は repo-wide follow-up として扱うべき structural findings である。

## Findings

### 1. tracked artifacts が多すぎる
- `artifacts/` tracked files: `12393`
- `web-client/artifacts/` tracked files: `5`
- 影響: clone / diff / review / handoff にノイズが混ざる。evidence と source of truth の境界も曖昧になる。
- 判定: `move/delete` 候補

### 2. `web-client` の lockfile が二重
- `web-client/package-lock.json`
- `web-client/pnpm-lock.yaml`
- workflow は npm 前提に見えるため、lockfile の canonical が二重化している。
- 判定: `keep/delete` 候補

### 3. reviewer packaging tool が並立
- keep 候補: `scripts/create-reviewer-submission-packet.sh`, `scripts/validate-reviewer-submission-packet.sh`
- 再判定 / delete 候補: `scripts/create-review-package.sh`, `scripts/create-review-bundles.sh`, `scripts/create-review-archive.sh`, `scripts/package-source-zip.ps1`
- 影響: reviewer submission の正本が見えにくい。
- 判定: `keep/delete` 候補

### 4. manual vs CI の境界がファイル配置と docs でずれる
- `.github/workflows/` にある実 CI: `e2e.yml`, `server-modernized-characterization.yml`, `server-modernized-static-analysis-gate.yml`, `web-client-test-shards.yml`
- `ops/tests/api-smoke-test/` は docs 上で CI 用 Compose と読めるが、実体は manual harness に近い
- `tests/e2e/README.md` は `artifacts/api-stability/...` を案内する一方、CI 実体は `artifacts/validation/e2e/...`
- 判定: `move` と docs 再整備候補

### 5. Flyway canonical と local baseline の説明差分
- canonical: `server-modernized/tools/flyway/sql`
- ただし `ops/db/local-baseline/README.md` は Hibernate による先行テーブル生成前提を残す
- 影響: schema source-of-truth と manual seed の境界が曖昧になる
- 判定: `keep/move` 候補

### 6. submodule hole は未検出
- `.gitmodules` の定義は見えるが、今回の棚卸しでは hole は確認していない
- 判定: `keep`

## Deferred Keep / Move / Delete

1. `keep`: `server-modernized/tools/flyway/sql` を唯一の canonical schema source として維持
2. `keep/delete`: `web-client` の package manager を 1 つに決め、不要 lockfile を削除
3. `keep/delete`: reviewer submission packet tool 以外の packaging tool を用途別に整理し、deprecated を削除
4. `move/delete`: tracked `artifacts/**` と `web-client/artifacts/**` を repo 外または untracked 出力へ移管
5. `move`: `ops/tests/api-smoke-test` を manual/ops 専用の位置付けに寄せる
6. `keep`: submodule は現状維持

## Recommended Execution Order

1. lockfile canonical を決定
2. packaging tool の canonical / deprecated を決定
3. tracked artifacts を移管
4. manual vs CI の harness を配置と docs の両面で整理
5. local baseline を Flyway canonical と競合しない manual seed に整理
