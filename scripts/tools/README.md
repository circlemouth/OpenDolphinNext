# scripts/tools

## create-review-archive.sh
- 状態: deprecated。logs-only archive は reviewer submission packet の正本ではない。
- 挙動: 実行すると fail し、新しい packet tool へ誘導する。

## create-review-package.sh
- 位置づけ: support。canonical reviewer flow ではなく、tracked source を軽量 zip 化する補助用途。
- 目的: このリポジトリをレビュワー提出向けに 1 本の軽量 zip にまとめる。
- 出力: `artifacts/review-bundles/OpenDolphin_WebClient-review-package-<RUN_ID>.zip`
- 方針:
  - git tracked files のみを対象にする
  - `client/` と `artifacts/` を完全除外する
  - `node_modules/`, `dist/`, `target/`, `build/`, `out/`, `tmp/`, `output/`, `coverage/`, `test-results/` を除外する
  - `REVIEW_PACKAGE_MANIFEST.txt` を zip 直下へ含める
- 使い方:
  - `./scripts/create-review-package.sh`
  - `./scripts/create-review-package.sh --run-id 20260414T080812Z`
  - `./scripts/create-review-package.sh --run-id 20260414T080812Z --out-dir ./artifacts/review-bundles`

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
