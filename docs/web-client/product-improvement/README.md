# Web Product Improvement Docs

このディレクトリは、`web-client` の product improvement トラックを進めるための開発支援資料を置きます。

## 位置づけ
- current contract の正本ではありません。
- manager handoff の正本でもありません。
- 以後の evidence pack、Phase 0 contract 整理、quick win 実装の入口として使います。

## 配置ルール
- manager 向け進行表は [`docs/managerdocs`](../../managerdocs/) に置きます。
- この配下には、実装前提の orchestrator prompt や Phase 0 prompt など、開発オーケストレーション資料だけを置きます。
- current contract を更新する時は、`web-client/notes/` 側の正本も同じ変更で更新します。

## 収録ファイル
- `phase0_product_contract_and_copy_20260330.md`
  - quick win 実装前に auth 例外 matrix、redirect reason taxonomy、lost-context matrix、feedback copy、a11y minimum、unknown を固定した Phase 0 成果物。
- `codex_prompt_web_product_improvement_orchestrator_20260329.txt`
  - evidence pack と quick win 実装を統括する Codex 用プロンプト。
- `chatgpt_prompt_phase0_product_contract_20260329.txt`
  - auth 例外 matrix、redirect reason taxonomy、lost-context matrix、feedback copy、a11y minimum をコード変更前に固めるための prompt。
