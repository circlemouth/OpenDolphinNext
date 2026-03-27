# Codex Prompt: WS8 reporting contract / README rewrite（source inventory 付き）

添付ドキュメント
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`
を読んで `WS8` を実装してください。

## ミッション
reporting を broad modernization せず、README と signing/TSA policy の current contract を repo-truth に合わせて固定する。reporting 実装 source が checkout にあるかを最初に確定する。

## サブエージェント指示
- subagent A: actual terminal checkout で reporting implementation source / module / tests の所在 inventory
- subagent B: `server-modernized/reporting/README.md` の非再現手順・stale policy を洗う
- subagent C: source がある場合の最小 hard-fail policy patch / black-box test 案、source が無い場合の doc-only rewrite 案を作る

## 分岐ルール
### A. reporting implementation source が checkout に存在する場合
- production-like signed export の signing/TSA failure outcome を fail-closed に寄せる
- local preview を unsigned 許容にするなら明示的に scope を分ける
- TSA unreachable / invalid key / signature required のテストを追加する
- README を repo-truth に書き換える

### B. reporting implementation source が checkout に存在しない場合
- 推測実装しない
- README を repo-truth にだけ書き換える
- source inventory と blocker を短い note に残す
- `signing-config.sample.json` は field rename しない

## README rewrite で最低限反映すること
- repo 現物で再現できない workflow / docs / renderer invocation は外す
- template precedence
- absolute path requirement
- signed export policy がどこまで repo で確認できたか

## 最後の報告
- reporting source inventory の結果
- 実装した policy/test/doc changes
- source 不在なら blocker (`unknown`)
- 実行した validation
