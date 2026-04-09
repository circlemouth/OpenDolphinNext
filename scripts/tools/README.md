# scripts/tools

## create-review-archive.sh
- 目的: このリポジトリの網羅的レビュー向け zip を生成する。現行コード/設定/契約 docs は残し、`docs/working-notes/` や `docs/web-client/product-improvement/` などの過去開発資料と、`node_modules` / `dist` / `target` などの生成物は除外する。
- ログ方針: `artifacts/`、`tmp/`、`.playwright-cli/` 配下で、フルパスが `*.log` または `*log*.txt` に該当するファイルだけを再取り込みし、レビュー補助ログとして zip に含める。
- 使い方:
  - リポジトリルートで `./scripts/create-review-archive.sh` を実行する。
  - RUN_ID を固定したい場合は `./scripts/create-review-archive.sh --run-id 20260409T232604Z`。
  - 出力先を変えたい場合は `./scripts/create-review-archive.sh --out-dir ./artifacts/review-bundles`。
- 出力: 既定では `artifacts/review-bundles/OpenDolphin_WebClient-review-<RUN_ID>.zip` を作成し、件数・ログ件数・sha256 を表示する。

## orca-artifacts-namer.js
- 目的: `artifacts/orca-connectivity/` 以下の Evidence ディレクトリ名が UTC タイムスタンプ (`YYYYMMDDThhmmssZ`) に統一されているかを自動検証し、命名揺れがある場合は推奨名を提案する。
- 事前条件: Node.js が利用可能であること。Python 実行は禁止されているため、必ず `node` コマンドで実行する。
- 使い方:
  - リポジトリルートで `node scripts/tools/orca-artifacts-namer.js` を実行すると、デフォルトで `artifacts/orca-connectivity/` を走査する。
  - 任意のパスを渡す場合は `node scripts/tools/orca-artifacts-namer.js <path/to/scan>`。
- 終了コード: 命名がすべて規約通りであれば 0。規約違反があると違反一覧と推奨名を表示して 1 を返す。実行エラー時も 1。
