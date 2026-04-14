# Test Boundary Matrix

分類ラベルは `CI / manual / helper / evidence / deprecated` を使用した。判定は repo 内の実体、README、workflow 定義、script 参照だけで行った。

| Path | Label | Basis |
| --- | --- | --- |
| `.github/workflows/e2e.yml` | CI | `npx playwright test tests/e2e --reporter=list` を実行し、`PLAYWRIGHT_ARTIFACT_DIR=artifacts/validation/e2e/<RUN_ID>` を設定する現行 CI entry。 |
| `.github/workflows/server-modernized-characterization.yml` | CI | server-modernized characterization gate を実行する現行 GitHub Actions workflow。 |
| `.github/workflows/server-modernized-static-analysis-gate.yml` | CI | server-modernized static analysis gate の現行 workflow。 |
| `.github/workflows/web-client-test-shards.yml` | CI | web-client の shard 実行を担う現行 workflow。 |
| `tests/e2e/` | CI | `.github/workflows/e2e.yml` が直接このディレクトリを走らせる。README も CI artifact path を明示するよう補正した。 |
| `tests/charts/` | helper | Playwright spec 群だが current workflow や root scripts から直接参照されていない。補助的な focused harness とみなす。 |
| `tests/reception/` | helper | reception 向け focused Playwright spec 群で、現行 CI entry からは未接続。 |
| `tests/images/` | helper | mobile images focused spec で、現行 CI entry からは未接続。 |
| `tests/playwright/` | helper | `fixtures.ts` と `utils/` を持つ共通 harness 層。テスト本体ではなく helper。 |
| `tests/review-package/` | helper | `node:test` ベースの support bundle regression。canonical reviewer submission flow の補助検証。 |
| `tests/review-packet/` | helper | `reviewer submission packet` regression。実行正本 script のサポート検証であり、GitHub Actions の直接 entry ではない。 |
| `ops/tests/api-smoke-test/` | manual | README が manual smoke と明記。`docker-compose.yml` は手元検証用で current CI entry ではない。 |
| `ops/tests/storage/attachment-mode/` | manual | README と shell harness が手動の attachment mode 検証手順を提供している。 |
| `ops/tests/security/factor2/` | manual | HTTP examples と README による factor2 手動検証資産。 |
| `ops/tests/orca-trial-requests/` | helper | XML request samples を置く補助素材で、CI でも manual runbook 本体でもない。 |
| `artifacts/validation/e2e/` | evidence | CI e2e の出力先。source of truth ではなく検証証跡。 |
| `artifacts/parity-manual/` | evidence | manual parity evidence の保存先。 |
| `artifacts/reviewer-submission-packets/` | evidence | reviewer submission packet の出力先。canonical flow の成果物だが docs source ではない。 |
| logs-only review archive flow | deprecated | `scripts/create-review-archive.sh` は retired と明記され、reviewer submission packet へ誘導する。 |

## README Reflection

- `docs/README.md` に matrix 要約を反映した。
- `tests/e2e/README.md` に CI artifact path と local default path の差分を反映した。
- `ops/README.md` に `ops/tests/api-smoke-test/` が manual であることを明記した。
