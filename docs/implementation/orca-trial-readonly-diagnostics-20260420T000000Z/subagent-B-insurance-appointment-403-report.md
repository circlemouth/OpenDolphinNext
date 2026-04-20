# Subagent B: insurance / appointment 403 diagnostics report

- RUN_ID: `20260420T055547Z`
- Branch: `codex/subagent-insurance-appointment-403-20260420`
- Worktree: `/Users/Hayato/Documents/GitHub/opendolphin-subagent-insurance-appointment-403`
- Scope: Phase 2.5 read-only diagnostics only. Phase 3 / Phase 4 and mutation requests were not run.

## 実施内容

- `web-client/scripts/qa-lib/orca-trial-preflight.mjs` に sanitized readiness failure category を追加した。
  - `localGuard`
  - `csrf`
  - `sessionAuthRole`
  - `upstream`
  - `methodPathMismatch`
  - `credentialUnavailable`
  - `wrapperErrorBeforeUpstream`
  - `parserBlankApiResult`
  - `upstreamNon2xxNoBody`
  - `unknownAmbiguous403`
- insurance readiness は従来どおり HTTP 403 を `ambiguous_readiness_failure` のまま維持し、`diagnosticCategory` / `readinessFailureCategory` で由来だけを補足するようにした。
- appointment dependency は `flowMode=direct_acceptance|appointment_row|unknown` を維持し、`direct_acceptance` では予約行 absence だけを blocker にしないことをテストで固定した。
- `appointment_row` は exact appointment row evidence がある場合だけ accepted とし、HTTP 403 は `appointment_missing` ではなく `ambiguous_readiness_failure` のままにした。
- candidate discovery / readonly preflight の insurance / appointment summary に sanitized diagnostic category を伝播した。
- read-only preflight artifact に raw `apiResultMessage` や raw `String(error)` を残す経路を縮小し、カテゴリ表現へ寄せた。

## 変更ファイル

- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
- `web-client/scripts/qa-weborca-candidate-discovery.mjs`
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
- `docs/implementation/orca-trial-readonly-diagnostics-20260420T000000Z/subagent-B-insurance-appointment-403-report.md`

## 403 source classification

今回の静的ロジックでは、HTTP 403 は accepted business evidence にはならない。`classification` は `ambiguous_readiness_failure` のまま維持される。

その上で、sanitized な補助分類として次を区別できる。

- local route guard 403: `readinessFailureCategory=localGuard`
- local CSRF 403: `readinessFailureCategory=csrf`
- local session/auth/role 403: `readinessFailureCategory=sessionAuthRole`
- upstream ORCA 403: `readinessFailureCategory=upstream` with numeric `upstreamStatus=403` when wrapper evidence exists
- method/path mismatch: `readinessFailureCategory=methodPathMismatch`
- credential unavailable / decrypt failure: `readinessFailureCategory=credentialUnavailable`
- wrapper error before upstream call: `readinessFailureCategory=wrapperErrorBeforeUpstream`
- blank `apiResult`: `readinessFailureCategory=parserBlankApiResult`
- upstream non-2xx with no body: `readinessFailureCategory=upstreamNon2xxNoBody`
- evidence-insufficient 403: `readinessFailureCategory=unknownAmbiguous403`

## Tests run

- `npm ci`
  - 完了。既存依存ツリーで `16 vulnerabilities (4 low, 4 moderate, 7 high, 1 critical)` が報告された。今回の変更では依存追加・更新はしていない。
- `npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts`
  - PASS: 52 tests
  - pretest の `verify:web-guard` も PASS。
- `npm run typecheck`
  - PASS
  - pretypecheck の `verify:web-guard` も PASS。
- `npx eslint scripts/qa-lib/orca-trial-preflight.mjs scripts/qa-weborca-candidate-discovery.mjs scripts/qa-weborca-readonly-preflight.mjs scripts/__tests__/orcaTrialPreflight.test.ts`
  - PASS
- 参考: `npm run lint -- ...` は repo-wide `eslint .` として実行され、exit 0。既存の repo-wide warning は多数残るが、error は 0。

## セキュリティ確認

- raw ORCA body、raw insurance detail、raw appointment detail、credential、cookie、Authorization、JSESSIONID、CSRF token 値は追加出力していない。
- diagnostic object は category / status / booleans / numeric upstream status の allowlist 情報のみを返す。
- 403 は insurance missing / appointment missing へ変換しない。
- `apiResult=21/23` は `business_rejected_insurance` のまま維持した。
- wrapper error と blank `apiResult` は accepted にならない。

## Known limitations

- source category は response body の sanitized error code/category/source/upstream status と method/path metadata からの分類であり、live server log や upstream ORCA raw response を読まない。
- generic `403 forbidden` だけで upstream evidence がない場合は local `sessionAuthRole` または `unknownAmbiguous403` に留める。これは誤って ORCA upstream 403 と断定しないため。
- live WebORCA Trial の現在の `00001`-`00011` failure がどの category へ落ちるかは、この commit 後に read-only harness を再実行するまで未確認。

## Remaining live read-only rerun

必要。次の read-only rerun で、`00001`-`00011` の insurance / appointment 403 が `localGuard`、`csrf`、`sessionAuthRole`、`upstream`、`unknownAmbiguous403` などのどれに分類されるかを確認する。
