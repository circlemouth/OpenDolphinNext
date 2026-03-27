# OpenDolphinNext Phase3+ Codex Shared Context

## このドキュメントの目的
Codex は chat 上の brief / 専門レビューを参照できない前提なので、Phase3+ Necessity Review の要点だけを実装向けに再掲する。

## 共有原則
- 現在の repo を正本とする。
- 後方互換性は考慮しない。
- legacy を残す理由が repo で説明できないなら、削除・隔離・非公開化を優先する。
- broad refactor より delete-first / public-surface shrink / contract drift 解消を優先する。
- 不明は `unknown` と明記し、推測で埋めない。
- 変更は production 運用を前提にする。
- build 成果物や生成物が zip に入っていても無視し、コードと repo 現物だけを見る。

## reopen してはいけない既存論点
以下は current repo が矛盾しない限り reopen 禁止:
- smoke patient 表示名 residual risk
- `/api/operations/readiness` への再移行
- summary route の再移行
- start-only transition を pause / finish 送信へ広げること
- blocked route zero-hit の再議論
- CSRF / logout / 2FA / attachment storage / document integrity の broad hardening 再開

## 今回の実装対象として有効な論点
- root-level legacy UI alias がまだ active な runtime path
- `verify-no-removed-routes.mjs` の守備範囲が狭いのに名前が広すぎる
- admin config / delivery の二重面
- admin client/server schema drift
- product runtime に見える `.mock` route 候補
- stale auth docs / env / QA scaffold
- chart event の AsyncContext fallback
- dead blocked ORCA resource / helper / test stack
- server config sample と runtime validator / implementation のズレ
- reporting の署名/TSA policy と README のズレ（ただし source 不在なら `unknown` 扱い）

## 実装時の共通ルール
- scope は狭く保つ。不要な命名統一や大規模整形はしない。
- 1 workstream = 1論点の完結まで。別 workstream の scope へ踏み込まない。
- 変更した contract には必ず近傍の test / verification を追加または更新する。
- 「repo のどの根拠を見てそうしたか」を最終報告に残す。
- `unknown` に当たったら勝手に仕様化せず、そこで止めて blocker を明記する。

## 推奨の Codex 進め方
- 最低 3 つのサブエージェントを使う:
  1. repo scout: 参照ファイルと影響範囲を洗う
  2. contract guard: reopen 禁止事項と regression risk を洗う
  3. implement/test: 最小パッチと検証コマンドを作る
- 最後にメイン agent が差分を統合し、チェックボックスを更新し、検証を実行する。
