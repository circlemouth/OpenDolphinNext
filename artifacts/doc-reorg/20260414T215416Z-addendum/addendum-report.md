# Doc Reorg Addendum Report

- Base run: `20260414T215416Z`
- Addendum scope: `docs/implementation/orca-order-alignment` の再判定、test boundary 再整理、root 入口 matrix、review package canonicalization、submodule / emptydir / UI drift の追補確認
- Evidence rule: 実リポジトリ現物と既存 report だけを使用し、build artifact は source-of-truth 判定に使わない

## Summary

前回の doc reorg は全体の方向性を維持しつつ、`docs/implementation/` を index-only へ寄せすぎていた点を補正した。active workflow background として必要な 3 点を `docs/implementation/orca-order-alignment/` に戻し、再利用用 review prompts は `docs/reference/` に寄せた。

同時に、CI / manual / helper / evidence / deprecated の test boundary を matrix 化し、`docs/README.md`、`README.md`、`ops/README.md`、`tests/e2e/README.md`、`docs/runbooks/reviewer-submission-packet.md`、`scripts/tools/README.md` に現行の呼び方と導線を反映した。

## Judgment Review

### accept as-is
- `docs/README.md` を primary doc entry とする全体方針
  - enduring / workflow / reference / archive / evidence の大枠分離は妥当で、そのまま維持した。
- `README.md` を薄い入口にし、深い導線を `docs/README.md` へ寄せた判断
  - addendum では build / ops 入口の明示だけを補った。
- `src/discovery/` を `docs/reference/repository-history/` へ集約した判断
  - current docs ではなく reference として扱う整合は崩していない。
- `artifacts/README.md` と `artifacts/doc-reorg/20260414T215416Z/` を evidence 扱いに固定した判断
  - source of truth に昇格させない整理はそのまま維持した。

### corrected in addendum
- `docs/implementation/orca-order-alignment/` を index-only に寄せすぎた判断
  - `orca_order_alignment_authoritative_spec_packet_20260407.md`
  - `orca_order_alignment_authoritative_tables_20260407.json`
  - `orca_order_alignment_execution_plan_checklist_self_contained_20260407.md`
  - 上記 3 点は active workflow background と再判定し、implementation 配下へ戻した。
- `opendolphin_orca_review_research_prompts_20260413/**` の archive 配置
  - dated packet ではなく reusable review / investigation prompt set なので reference へ修正した。
- test boundary の説明不足
  - `docs/README.md` に matrix 要約を追記し、`tests/e2e/README.md` の artifact path を CI 実体に合わせて補正した。
- root 入口の build / ops 区分不足
  - `README.md` に docs / build / ops の入口を明記した。
- review-package / reviewer-submission-packet の名称混在
  - `docs/runbooks/reviewer-submission-packet.md` と `scripts/tools/README.md` で canonical name を `reviewer submission packet` に統一した。
- UI guideline の DADS 近似記述
  - `docs/web-client/ux/web-client-ui-guideline.md` を project-local adaptation 専用に縮約し、DADS の焼き直しを除去した。

### deferred
- lockfile 二重管理
  - `web-client/package-lock.json` と `web-client/pnpm-lock.yaml` のどちらを正本にするかは non-doc structural issue のため未変更。
- review bundle / reviewer submission script 群のコード統合
  - docs 上の canonicalization は実施したが、script 本体の廃止統合はこの addendum では行っていない。
- tracked artifacts / placeholder 整理
  - `artifacts/review-bundles/` と `artifacts/reviewer-submission-packets/` の tracked contents は evidence ノイズだが、この addendum では doc 判定のみ行った。
- Flyway canonical と local baseline の構造是正
  - docs 上は `server-modernized/tools/flyway/sql/` を canonical とする前提を維持し、実体の整理は deferred のまま。

## Files Updated In Addendum

- `README.md`
- `docs/README.md`
- `docs/implementation/orca-order-alignment/README.md`
- `docs/archive/orca-order-alignment/README.md`
- `docs/reference/orca-order-alignment/README.md`
- `docs/runbooks/reviewer-submission-packet.md`
- `docs/web-client/ux/web-client-ui-guideline.md`
- `ops/README.md`
- `scripts/tools/README.md`
- `tests/e2e/README.md`
- `artifacts/doc-reorg/20260414T215416Z-addendum/*`

## Validation

- doc link check: `server-modernized/tools/ci/check-doc-links.sh`
- stale path grep: `artifacts/doc-reorg/20260414T215416Z-addendum/stale-path-grep.txt`
- move manifest: `artifacts/doc-reorg/20260414T215416Z-addendum/moved-file-manifest.txt`
- changed file list: `artifacts/doc-reorg/20260414T215416Z-addendum/git-diff-name-status.txt`
