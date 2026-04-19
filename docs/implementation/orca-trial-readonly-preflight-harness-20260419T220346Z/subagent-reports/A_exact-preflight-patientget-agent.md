【ワーカー報告】

作業RUN_ID: `20260419T220551Z`
指示RUN_ID: `20260419T220346Z`
Branch: `codex/orca-exact-preflight-patientget-20260419T220346Z`
Worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-exact-preflight-patientget-20260419T220346Z`
Commit: `7f64bd3a7 test(web-client): harden exact ORCA patient preflight`

変更ファイル:
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
- `docs/runbooks/release-validation.md`
- `docs/runbooks/reviewer-submission-packet.md`

実施内容:
- exact preflight の公式患者存在確認を `/api/orca/official/patients/batch` から `/api/orca/official/patientgetv2?id=<patientId>&class=01&format=json` に変更。
- `Api_Result`、`Patient_Information`、完全一致 `Patient_ID` が揃った parsed ORCA body だけを公式患者証跡として accepted。
- `officialPatientExistence` / `officialPatientEvidence` を allowlist 済みフィールドだけに制限し、raw patient detail を summary に残さない形へ変更。
- 00001〜00011 の patientgetv2 failure dimensions を `officialPatientReadinessAxes.patientgetv2[]` に機械可読で出すようにし、「公式初期患者が存在しない」とは結論しない文言に固定。
- batch DTO 形状、`Api_Result=10`、`Patient_Information` 欠落、ID mismatch、patient-not-found wording の拒否をテストで固定。

検証コマンド / exit code:
- `git worktree add -b codex/orca-exact-preflight-patientget-20260419T220346Z ...` -> `0`
- `cd web-client && node --check scripts/qa-weborca-readonly-preflight.mjs && node --check scripts/qa-lib/orca-trial-preflight.mjs` -> `0`
- `cd web-client && npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts` -> 初回 `127`（`vitest` 未配置）
- `cd web-client && npm ci` -> `0`（既存依存の audit 警告あり、lockfile変更なし）
- `cd web-client && npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts` -> `0`（27 tests passed）
- `cd web-client && npm run verify:web-guard` -> `0`
- `cd web-client && npx eslint scripts/qa-weborca-readonly-preflight.mjs scripts/qa-lib/orca-trial-preflight.mjs scripts/__tests__/orcaTrialPreflight.test.ts` -> `0`
- `cd web-client && npm run typecheck` -> `0`
- `cd web-client && npm run build` -> `0`
- `git diff --check` -> `0`
- `git commit -m "test(web-client): harden exact ORCA patient preflight"` -> `0`

セキュリティ確認:
- batch DTO の患者 summary を公式存在証跡として誤受理する misuse を拒否。
- raw ORCA body / 氏名等の患者詳細を summary evidence に残さない allowlist 化を追加。
- `acceptedForPhase3Attempt` は全 readiness axis、`acceptmodv2ReadOnlyDiagnostic.acceptedForPhase3Attempt === true`、`rawSensitiveFieldsExcluded === true` を満たす場合だけ true。

ブロッカー:
- なし。
- live ORCA、Phase 3、Phase 4、fullflow、mutation 実行はしていません。
