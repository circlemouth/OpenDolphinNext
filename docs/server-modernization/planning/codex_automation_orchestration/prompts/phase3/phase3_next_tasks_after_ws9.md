# Phase3+ Next Tasks after WS9

## 背景
WS1〜WS9 により、runtime / release hardening の大半は repo に反映済み。
現在の主な残課題は static-analysis gate の baseline 未解消。
current repo を正本とし、後方互換性は考慮しない。

## 方針
- [ ] current repo を source of truth とする
- [ ] delete-first / simplification を優先する
- [ ] broad refactor を避ける
- [ ] fail-on-error の意味を弱めない
- [ ] Checkstyle / PMD には広げない
- [ ] 閉じた Phase2 論点は reopen しない
- [ ] unknown は unknown と明記する

## T10-A: static-analysis workflow の truthful 化（条件付き）
- [ ] `.github/workflows/server-modernized-static-analysis-gate.yml` が default の required green path に入ると CI 恒常赤になるか確認する
- [ ] required green path に入る前提なら、workflow を manual/nightly/optional 側へ逃がす
- [ ] `pom.xml` の failOnError や threshold は変更しない
- [ ] `scripts/server-modernized/verify-static-analysis.sh` は保持する
- [ ] 変更理由を README か workflow comment に最小限で残す

### 受け入れ条件
- [ ] static-analysis の intent は保持される
- [ ] failOnError を弱めていない
- [ ] default green path を恒常赤にしない
- [ ] branch protection 外の事項は推測で埋めていない

## T10-B: static-analysis baseline inventory + Wave 1 burn-down
- [ ] `scripts/server-modernized/verify-static-analysis.sh` を現状 repo で再実行する
- [ ] SpotBugs / FindSecBugs の結果を module / package / bug code / count で集計する
- [ ] inventory markdown を追加する
- [ ] findings を 3 クラスタへ分ける
  - [ ] Cluster A: security / rest / runtime-config / integrity
  - [ ] Cluster B: session / orca / transport / persistence
  - [ ] Cluster C: reporting / utility / その他
- [ ] 各クラスタで smallest viable diff の修正を入れる
- [ ] false positive の blanket suppression はしない
- [ ] どうしても filter が必要なら、対象・理由・再発防止を明記する
- [ ] before/after 件数を記録する

### 受け入れ条件
- [ ] inventory が repo 内に残る
- [ ] baseline 件数が material に減る、または green 化する
- [ ] `pom.xml` の failOnError / threshold を弱めていない
- [ ] Checkstyle / PMD には広げていない
- [ ] 次の burn-down wave が明確になる

## Wave 2 支援資料
- `docs/development/supporting/phase3_wave2_prompt_pack/README.md`
- 目的: T10-B の次に進める static-analysis Wave 2 の現行支援資料。inventory 正本は `docs/server-modernization/static-analysis-baseline-inventory.md`。

## Wave 3 支援資料
- `docs/development/supporting/phase3_wave3_prompt_pack/README.md`
- 目的: Wave 2 の次に進める static-analysis Wave 3 の現行支援資料。inventory 正本は `docs/server-modernization/static-analysis-baseline-inventory.md`。

## Wave 4 支援資料
- `docs/development/supporting/phase3_wave4_prompt_pack/README.md`
- 目的: Wave 3 の次に進める static-analysis Wave 4 の現行支援資料。inventory 正本は `docs/server-modernization/static-analysis-baseline-inventory.md`。

## Post-Decision 支援資料
- `docs/development/supporting/phase3_post_decision_prompt_pack/README.md`
- 目的: repo-only で確定した static-analysis / release gate の判断を repo-local truth として反映する現行支援資料。

## T10-C: stale QA/admin contract cleanup
- [ ] `web-client/scripts/qa-order-master-ui.mjs`
- [ ] `web-client/scripts/qa-soap-persistence.mjs`
- [ ] 上記から `/api/admin/delivery` を除去し `/api/admin/config` に合わせる
- [ ] active scripts/tests/src に残る `/api/admin/delivery` を grep で洗う
- [ ] `fetchEffectiveAdminConfig()` が単なる alias なら、低リスクなら削除または rename する
- [ ] churn が大きいなら alias は残してもよいが、旧 route を意味する実体は残さない

### 受け入れ条件
- [ ] active QA/script surface に `/api/admin/delivery` が残らない
- [ ] admin config contract の source of truth が一貫する
- [ ] typecheck / 該当 test / grep が通る
- [ ] unrelated cleanup を混ぜない

## 今はやらない
- [ ] Checkstyle / PMD の全面有効化
- [ ] `KarteServiceBean` / `KarteLegacyArtifactSupport` の深い分割
- [ ] closed Phase2 issue の reopen
