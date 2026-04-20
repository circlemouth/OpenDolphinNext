# 【ワーカー報告】Subagent A official patientgetv2 500 diagnostics

- RUN_ID: `20260420T000000Z`
- worktree: `opendolphin-subagent-official-patientget-500`
- branch: `codex/subagent-official-patientget-500-20260420`
- scope: Phase 2.5 read-only diagnostics only

## 実施内容

- `patientgetv2` official existence 判定に、accepted / rejected とは別の sanitized diagnostic classification を追加した。
- `localStatus`, `upstreamStatus`, `endpointKind`, `method`, `diagnosticCategory`, `errorCategory`, `exceptionClassName`, `hasParsedBody`, `hasPatientInformation`, `apiResultCategory`, `exactPatientIdMatch`, `bodyHash`, `evidenceHash` を evidence に残すようにした。
- JSON parse 失敗時に `{}` と同一視せず、`parsedOrcaBody=false` として `orca_body_missing` に分類するようにした。
- `/api/orca/official/patients/batch` 型の DTO は、raw ORCA `Patient_Information` がない限り official existence evidence として accepted にならないことをテストで固定した。
- raw ORCA body、患者氏名・住所・保険詳細、credential、Cookie、Authorization、CSRF token、credential-bearing URL は追加 evidence に含めていない。

## 変更ファイル

- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
- `web-client/scripts/qa-weborca-candidate-discovery.mjs`
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
- `docs/implementation/README.md`
- `docs/README.md`
- `docs/implementation/orca-trial-readonly-diagnostics-20260420T000000Z/subagent-A-official-patientget-500-report.md`

## 分類できるようになった 500

現在の `00001`-`00011` が `status=500` / `http_not_2xx` だけに潰れていたケースは、safe body/header に手掛かりがあれば次のように分類できる。

- local route exception: `diagnosticCategory=local_exception`
- local parser failure: `diagnosticCategory=parser_error`
- upstream ORCA non-2xx: `diagnosticCategory=upstream_http_not_2xx`, `upstreamStatus=<known>`
- credential / ORCA transport unavailable: `diagnosticCategory=credential_unavailable`
- auth / role / CSRF local failure: `diagnosticCategory=local_auth_failure`
- safe evidence だけでは出所が特定不能: `diagnosticCategory=unknown`, `upstreamStatus` は未設定

HTTP 500 は常に rejected のままで、official 初期患者の不存在推定には使わない。

## accepted 条件

official patient existence accepted は次をすべて満たす場合だけ。

- local HTTP が 2xx
- parsed ORCA body がある
- `apiResult` が all-zero
- raw ORCA `Patient_Information` がある
- 正規化後の `Patient_ID` が完全一致する
- patient-not-found wording がない
- response category が `empty` / `not_found` ではない

## テスト

- `cd web-client && npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts` 成功（51 tests）
- `cd web-client && npm run typecheck` 成功
- `cd web-client && node --check scripts/qa-lib/orca-trial-preflight.mjs && node --check scripts/qa-weborca-candidate-discovery.mjs && node --check scripts/qa-weborca-readonly-preflight.mjs` 成功
- `cd web-client && npm run lint` 成功（既存警告のみ、エラー 0）
- `cd web-client && npm run test:ci -- --run scripts/__tests__/orcaTrialPreflight.test.ts` 成功
- `cd web-client && npm run ci` 成功（全テスト 1211 passed / 2 skipped、build 成功）

`npm ci` 実行時に既存依存の audit 警告は表示されたが、今回 dependency の追加・更新はしていない。

## 検証した misuse case

- 500 を患者不在として扱わない。
- batch DTO や local projection を raw ORCA `Patient_Information` の代替証跡として採用しない。
- raw body / 患者詳細 / credential / session token を診断 evidence へ出さない。

## 既知制限

- upstream status は safe response header、safe error body field、または sanitized message の `ORCA HTTP response status <code>` からのみ推定する。これらがない local 500 は `unknown` のままにする。
- live WebORCA への再実行はこのタスクでは行っていない。
- 500 の実 source 確認には、更新後の `qa-weborca-candidate-discovery.mjs` または `qa-weborca-readonly-preflight.mjs` の live read-only rerun が必要。

## 残リスク

- サーバーが upstream status を structured field/header として返さない経路では、raw body なしに source を確定できない。これは安全側に倒して `unknown` とする。
- 今回は Phase 3 / Phase 4 mutation request を実行していない。
