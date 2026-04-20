# Subagent C local selector candidates report

- RUN_ID: `20260420T114203Z`
- worktree: `/Users/Hayato/Documents/GitHub/opendolphin-subagent-local-selector-candidates`
- branch: `codex/subagent-local-selector-candidates-20260420`
- base commit: `4e788dd34aa3cf67f041e1f67ddb2edcf62094b3`

## Threat model before editing

1. local selector false-positive substituted for official ORCA existence:
   - 対策: candidate acceptance / preflight validation は official patientget exact evidence を必須にし、local selectable は別軸の readiness としてのみ扱う。
2. multiple blockers hidden by one primary reason:
   - 対策: candidate row に `primaryRejectionReason` と `rejectionReasons[]` を追加し、保険・予約・local exact match・selector・medical-information identity の複数 blocker を同時に保持する。
3. raw local patient identity leaking into artifacts:
   - 対策: local/selector/medical-info diagnostics は count / boolean / failed dimension のみを出し、氏名・生年月日・住所・raw chart detail を追加しない。
4. non-boolean Phase 3 flag false-passing:
   - 対策: exact preflight validation は `acceptedForPhase3Attempt === true` のみ許可する既存 gate を維持し、全 readiness axes の accepted 判定テストを追加した。

## Changed files

- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
  - `00001` / `00005` を preferred exact-preflight proposal として選ぶ helper を追加。ただし accepted proposal row の中からのみ選ぶ。
  - candidate rejection collection を追加し、`primaryRejectionReason` / `rejectionReasons[]` を生成。
  - sanitized diagnostics に `exactNormalizedPatientIdMatchCount`、selector option counts、selector target match booleans を追加。
- `web-client/scripts/qa-weborca-candidate-discovery.mjs`
  - candidate row に `primaryRejectionReason` / `rejectionReasons[]` を出力。
  - accepted proposal selection を preferred helper に統一。
  - discovery summary / markdown / readiness axes に rejection reasons と selection policy を出力。
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
  - candidate selection を preferred helper に統一し、accepted official+insurance+local candidate の中で `00001` / `00005` を優先。
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
  - insurance rejected の 00001-like row が mutation-ready にならないこと、複数 blocker が `rejectionReasons[]` に残ること、local exact missing が official absence と混同されないこと、preferred selection の条件を追加。
- `web-client/scripts/__tests__/acceptmodv2IdentityGate.test.ts`
  - exact selected-candidate preflight が official / insurance / appointment / local / selector / medical-information identity の全 accepted を要求することを追加。

## Results

- `npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts scripts/__tests__/acceptmodv2IdentityGate.test.ts`
  - first attempt: exit `127`
  - reason: worktree dependencies were not installed and `vitest` was unavailable. `verify:web-guard` itself passed before the missing binary.
- `npm ci`
  - exit `0`
- `npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts scripts/__tests__/acceptmodv2IdentityGate.test.ts`
  - exit `0`
  - result: 2 files passed, 104 tests passed.
- `npm run lint`
  - exit `0`
  - result: 0 errors. Existing repo-wide warnings remain.
- `npm run typecheck`
  - exit `0`
- `npm run build`
  - exit `0`
  - result: production build succeeded. Existing chunk-size warning only.
- `npm run test:ci`
  - exit `0`
  - result: 185 files passed, 1237 tests passed, 2 skipped.
- `npm audit --audit-level=high`
  - exit `0`
  - result: high severity以上はなし。既存 low severity 4 件のみ。

## Security / artifact handling

- Phase 3 / Phase 4 / fullflow は実行していない。
- `acceptmodv2` mutation request は実行していない。
- raw credential、Cookie、Authorization、JSESSIONID、CSRF、raw ORCA body、raw patient detail、raw insurance detail は artifact / report に出していない。
- HAR / trace / video / raw screenshot / raw network dump は作成していない。

## DADS/UI

not materially applicable

## Residual risk

- live ORCA Trial の 00001 / 00005 が insurance / appointment accepted へ変わった場合、candidate discovery は exact selected-candidate preflight proposal まで進むが、Phase 3 mutation authorization は引き続き `qa-weborca-readonly-preflight.mjs` の exact preflight summary が accepted になるまで不可。
- repo-wide lint warnings と npm audit low severity 4 件は今回変更範囲外。今回変更で新規 error / high severity は確認していない。
