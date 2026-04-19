# A phase25-candidate-preflight-agent report

- RUN_ID: `20260419T131740Z`
- Branch: `codex/phase25-candidate-preflight-20260419T131740Z`
- Worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-phase25-candidate-preflight-20260419T131740Z`

## 変更ファイル

- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
- `web-client/scripts/qa-weborca-candidate-discovery.mjs`
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
- `web-client/scripts/__tests__/acceptmodv2IdentityGate.test.ts`
- `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/subagent-reports/A_phase25-candidate-preflight-agent.md`

## 実施内容

- 候補探索を Phase 3 許可ではなく proposal-only として固定し、`candidateDiscoveryAloneAuthorizesPhase3=false`、`acceptedForPhase3Attempt=false`、`phase3.ran=false`、`phase4.ran=false`、`mutationPolicy.prohibited=true` を summary に明示した。
- 候補行の proposal 成立は `acceptedForExactPreflightProposal` に分離し、candidate discovery 内の `acceptedForPhase3Attempt` は常に false になるよう固定した。
- `acceptedCandidateCount=0` の verdict を `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` に変更した。公式 Trial 初期患者 `00001`-`00011` は登録済みデータという前提を維持し、current harness / API endpoint / auth / ID normalization / response parser / insurance readiness / appointment dependency / exact preflight criteria のいずれかで Phase 3 mutation-ready evidence が未充足であることを示す。
- 候補探索 summary に `readinessAxes` を追加し、patientgetv2 status、parsed ORCA body、Api_Result all-zero、Patient_Information、exact Patient_ID、patient-not-found wording absence、usable insurance、appointment dependency、selector、local selectable、mutation block count を機械可読に分離した。
- 公式患者存在判定を HTTP 2xx、parsed ORCA object、all-zero apiResult、Patient_Information present、exact normalized Patient_ID、patient-not-found wording absence の全条件で fail-closed にした。
- Request_Number=00 diagnostic は `apiResult=10` を rejected、`apiResult=60` を no-existing-acceptance diagnostic かつ mutation success ではない状態、`apiResult=00` を existing-acceptance diagnostic かつ Phase 3 authorization 不可として固定した。
- exact selected-candidate preflight gate は source/flow、refs/hashes、input identity、diagnostic、`rawSensitiveFieldsExcluded=true`、artifact path/hash を必須にするテストを追加した。

## 検証

- `cd web-client && npx vitest run scripts/__tests__/orcaTrialPreflight.test.ts scripts/__tests__/acceptmodv2IdentityGate.test.ts`
  - Exit code: `0`
  - Result: `2 passed`, `42 passed`
- `cd web-client && node --check scripts/qa-weborca-candidate-discovery.mjs scripts/qa-weborca-readonly-preflight.mjs scripts/qa-lib/orca-trial-preflight.mjs scripts/qa-lib/acceptmodv2-identity-gate.mjs`
  - Exit code: `0`
- 追加確認: 各対象 `.mjs` を個別に `node --check` 実行
  - Exit code: `0`

初回 Vitest は worktree 内の `web-client/node_modules` が未復元で `vite` / `vitest` を解決できず exit code `1`。`npm ci` で `package-lock.json` 通りに依存を復元して再実行した。依存ファイルは変更していない。`npm ci` は既存依存の audit として critical 1 / high 7 / moderate 4 / low 4 を報告したが、本タスクでは依存追加・更新は行っていない。

## セキュリティノート

- ORCA endpoint credential、Cookie、Authorization、JSESSIONID、CSRF、raw password、credential-bearing URL、患者機微詳細は追加出力していない。
- discovery は proposal-only であり、candidate discovery artifact 単独では Phase 3 mutation を許可しない。
- read-only evidence の不備は fail-closed とし、patient-like body や local selectable だけでは official patient existence として受理しない。
- `0000001` は legacy local smoke seed として rejected のまま維持した。`00001`-`00011` は公式 Trial 初期患者前提の probe candidates であり、mutation-ready 判定には exact selected-candidate preflight が必須。

## 残リスク

- 今回は live ORCA / Phase 3 / Phase 4 / mutation scripts は指示に従い実行していない。live endpoint、auth、actual ORCA response shape、保険 readiness、appointment dependency の実証は read-only harness 実行時の artifact で確認が必要。
- `npm ci` で既存依存の脆弱性 advisory が表示された。依存更新は本ブランチのスコープ外のため未変更。
