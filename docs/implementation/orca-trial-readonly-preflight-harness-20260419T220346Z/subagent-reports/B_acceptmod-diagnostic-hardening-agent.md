【ワーカー報告】

branch: `codex/orca-acceptmod-diagnostic-hardening-20260419T220346Z`
worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-acceptmod-diagnostic-hardening-20260419T220346Z`
commit: `485cc8db2 Harden acceptmod readonly diagnostic gate`

変更ファイル:
- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`

実施内容:
- `apiResult=60` の Phase 3 許可条件を fail-closed 化しました。
- HTTP non-2xx / 0、wrapper/upstream/errors/errorCategory、body parse 失敗、message-only success では `acceptedForPhase3Attempt=false` にしました。
- read-only preflight 呼び出し側で raw body を artifact 化せず、JSON parse 成否だけを分類関数へ渡すようにしました。
- 500/403/404/0/302 + `apiResult=60`、wrapper error、parse 失敗、`apiResult=00/10/21/23`、message-only success の regression tests を追加しました。

脅威・対策・検証:
- misuse case: HTTP 500/403 なのに wrapper body の `apiResult=60` で Phase 3 が許可される。
- misuse case: wrapper/upstream error 付き応答の `apiResult=60` が成功扱いされる。
- misuse case: body parse 失敗または成功メッセージだけで診断成功扱いされる。
- 対策: `executed=true`、HTTP 2xx、wrapper/error 系なし、body parse 済み、normalized `apiResult === "60"` の全条件を満たす場合のみ Phase 3 試行許可。
- 残リスク: live ORCA 実行は指示により未実施。live 成功は主張しません。

コマンド結果:
- `git worktree add -b ...` exit 0
- 初回 `npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts` exit 127（worktree に `node_modules` なし）
- PATH 流用での再試行 exit 1（Vite config の ESM 解決が worktree 側 `node_modules` を要求）
- `npm ci` exit 0（既存 lockfile 由来の audit 表示: 16 vulnerabilities）
- `npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts` exit 0（37 passed）
- `npm run ci` exit 0（185 files, 1193 passed, 2 skipped; build OK）
- `npm run lint` exit 0（既存 warnings 492、errors 0）
- `git diff --check` exit 0
- `git commit -m "Harden acceptmod readonly diagnostic gate"` exit 0

更新ドキュメント: なし。今回の明示 write scope が acceptmod diagnostic hardening と related tests のみに限定されていたため、コードとテストに絞りました。

ブロッカー: なし。worktree は clean です。
