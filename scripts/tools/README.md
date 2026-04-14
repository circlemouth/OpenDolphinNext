# scripts/tools

## create-review-archive.sh
- 状態: 廃止。logs-only archive は reviewer submission packet の正本ではない。
- 挙動: 実行すると fail し、新しい packet tool へ誘導する。

## create-reviewer-submission-packet.sh
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
