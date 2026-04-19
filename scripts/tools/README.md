# scripts/tools

## create-review-archive.sh
- 状態: deprecated。logs-only archive は reviewer submission packet の正本ではない。
- 挙動: 実行すると fail し、新しい packet tool へ誘導する。

## create-review-package.sh
- 位置づけ: support。canonical reviewer flow ではなく、tracked source を軽量 zip 化する補助用途。
- 目的: このリポジトリをレビュワー提出向けに 1 本の軽量 zip にまとめる。
- 出力: `artifacts/review-bundles/OpenDolphin_WebClient-review-package-<RUN_ID>.zip`
- 方針:
  - git tracked files を base とし、`--include-review-log-manifest` 指定時だけ manifest-listed evidence を追加する
  - `client/` と `artifacts/` を完全除外する
  - `node_modules/`, `dist/`, `target/`, `build/`, `out/`, `tmp/`, `output/`, `coverage/`, `test-results/` を除外する
  - `REVIEW_PACKAGE_MANIFEST.txt` を zip 直下へ含める
  - `--include-review-log-manifest` 指定時のみ、manifest に列挙した sanitized review log / evidence contract を追加同梱する
  - `.git/` は含めず、clean checkout 証跡は主張しない
  - manifest と sidecar summary は `packageMode=extracted_review_subset`、`clean_checkout_claim=not_verified`、`full_source_secret_scan_claim=not_claimed` を明示する
  - manifest-listed evidence は sanitized summaries / reports / command logs に限定し、raw ORCA artifact、HAR、network/request/response、画像、trace/video、credential-bearing URL、Cookie、Authorization、JSESSIONID、CSRF、raw session、raw password を拒否する
  - Phase 2.5 の `acceptedCandidateCount=0` は、`00001`〜`00011` について current harness / API / auth / parser / readiness / exact-preflight criteria の read-only evidence が mutation-ready まで揃っていない、という意味に限定する。公式初期患者が存在しない証明として扱わない
- 使い方:
  - `./scripts/create-review-package.sh`
  - `./scripts/create-review-package.sh --run-id 20260414T080812Z`
  - `./scripts/create-review-package.sh --run-id 20260414T080812Z --out-dir ./artifacts/review-bundles`
  - `./scripts/create-review-package.sh --run-id 20260418T224551Z --name-suffix -with-dynamic-evidence --include-review-log-manifest docs/implementation/opendolphin-postfix-static-remediation-20260418/REVIEW_LOG_INCLUSIONS_MANIFEST.txt`

## create-review-package-curated.sh
- 位置づけ: support。50MB 制約つきの curated review bundle。
- 目的: current docs / workflow docs / current source / selected doc-reorg reports を含めつつ、legacy tree と大きい非必須 binary を落としてレビュー zip を 50MB 以内に収める。
- 出力: `artifacts/review-bundles/OpenDolphin_WebClient-review-package-curated-<RUN_ID>.zip`
- 方針:
  - current docs と active workflow docs を含める
  - `artifacts/doc-reorg/` の text/log reports を再同梱する
  - reviewer 指定の archive / repository-history 資料は個別 allowlist で常時含める
  - `client/`, `server/`, `ext_lib/`, `docker/orca/jma-receipt-docker/` を除外する
  - `docs/archive/` はデフォルトで除外し、必要時だけ `--include-archive-docs` で含める
  - `ops/assets/fonts/NotoSansCJKjp-Regular.otf` など大きい review-irrelevant binary を除外する
  - zip size が `--size-limit-mb` を超えたら fail する
- 使い方:
  - `./scripts/create-review-package-curated.sh`
  - `./scripts/create-review-package-curated.sh --run-id 20260415T010203Z`
  - `./scripts/create-review-package-curated.sh --run-id 20260415T010203Z --size-limit-mb 50`
  - `./scripts/create-review-package-curated.sh --run-id 20260415T010203Z --include-archive-docs`

## create-reviewer-submission-packet.sh
- 位置づけ: canonical。reviewer 提出の現行正本フロー。
- 目的: accepted ref / accepted HEAD / RUN_ID を固定した reviewer submission packet を生成する。
- 出力: `submission-packet-<RUN_ID>/` と `submission-packet-<RUN_ID>.zip`。
- レイアウト:
  - `review-checkout/`: `.git` と `origin/master` を持つ clean checkout
  - `closeout-packet/`: 同一 RUN_ID / 同一 HEAD の closeout evidence
  - `manifest.json`, `manifest.sha256`, `README_REVIEW.md`
- 使い方:
  - `./scripts/create-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z`
  - `./scripts/create-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z --output ./artifacts/reviewer-submission-packets`
  - `./scripts/create-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z --dry-run`

## validate-reviewer-submission-packet.sh
- 位置づけ: canonical support。reviewer submission packet の検証ステップ。
- 目的: 生成済み packet の required file、HEAD 一致、review-checkout clean、絶対パス混入なしを再検証する。
- 使い方:
  - `./scripts/validate-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z`
  - `./scripts/validate-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z --output ./artifacts/reviewer-submission-packets`

## orca-artifacts-namer.js
- 目的: `artifacts/orca-connectivity/` 以下の Evidence ディレクトリ名が UTC タイムスタンプ (`YYYYMMDDThhmmssZ`) に統一されているかを自動検証し、命名揺れがある場合は推奨名を提案する。
- 事前条件: Node.js が利用可能であること。Python 実行は禁止されているため、必ず `node` コマンドで実行する。
- 使い方:
  - リポジトリルートで `node scripts/tools/orca-artifacts-namer.js` を実行すると、デフォルトで `artifacts/orca-connectivity/` を走査する。
  - 任意のパスを渡す場合は `node scripts/tools/orca-artifacts-namer.js <path/to/scan>`。
- 終了コード: 命名がすべて規約通りであれば 0。規約違反があると違反一覧と推奨名を表示して 1 を返す。実行エラー時も 1。

## Naming Rule
- 現行正本名は `reviewer submission packet`。
- `review package` は support bundle。
- `review archive` は deprecated。
