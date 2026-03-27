# Codex Prompt: WS1 root-level legacy route surface 縮小

以下の 2 つの添付ドキュメントを先に読んでください。
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`

対象は `WS1: root-level legacy route surface 縮小 + verify script の守備範囲是正` です。

## あなたの役割
OpenDolphinNext の実装担当として、repo 正本・後方互換性非考慮・delete-first 方針で WS1 を完遂してください。

## 進め方
1. まずサブエージェントを最低 3 つ立てる。
   - subagent A: `web-client/src/AppRouter.tsx` 起点で non-facility path redirect の全 usage / tests を inventory
   - subagent B: `FacilityLoginEntry` / `loginRouteState` / login redirect tests を調べ、壊してはいけない current intent を整理
   - subagent C: `verify-no-removed-routes.mjs` と `package.json` scripts の rename / wording change 案、必要 test を整理
2. 3 つの結果を統合し、WS1 checklist を上から順に潰す最小パッチを作る。
3. 実装後、WS1 のチェックボックスを更新できるよう要点をまとめる。
4. target tests / typecheck / build を実行する。
5. 最後に以下を報告する。
   - changed files
   - root path behavior の before/after
   - verify script の before/after
   - 実行した validation
   - 未解決があれば `unknown`

## 実装ガード
- `/` は fallback を残してよいが、`/charts` `/patients` `/administration` 等 arbitrary root path を `/f/:facilityId/...` へ再構成しない。
- `/login` と `/f/:facilityId/login` の current flow は壊さない。
- facility-scoped path の redirect intent は壊さない。
- readiness / local-summary / blocked outpatient route を reopen しない。
- broad route refactor はしない。WS1 に閉じる。

## 最低限見るべきファイル
- `web-client/src/AppRouter.tsx`
- `web-client/src/features/login/FacilityLoginEntry.tsx`
- `web-client/src/features/login/loginRouteState.ts`
- `web-client/src/features/login/__tests__/FacilityLoginEntry.test.tsx`
- `web-client/src/__tests__/AppRouter.login-redirect.test.tsx`
- `web-client/scripts/verify-no-removed-routes.mjs`
- `web-client/package.json`
