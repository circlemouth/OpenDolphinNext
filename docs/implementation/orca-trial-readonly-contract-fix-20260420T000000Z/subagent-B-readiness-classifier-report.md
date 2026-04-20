# Subagent B readiness classifier report

- RUN_ID: `20260420T114136Z`
- Branch: `codex/subagent-readiness-classifier-20260420`
- Worktree: `/Users/Hayato/Documents/GitHub/opendolphin-subagent-readiness-classifier`
- Scope: read-only ORCA Trial readiness classifier hardening

## 脅威モデル

1. HTTP 200 false-pass
   - 脅威: wrapper route が HTTP 200 を返しただけで insurance / appointment を mutation-ready と誤判定する。
   - 対策: insurance は HTTP 200、parsed ORCA body、all-zero `apiResult`、usable combination evidence をすべて必須化。appointment は parsed body と endpoint-specific `apiResult` を分類し、HTTP 200 単独では accepted にしない。

2. ORCA contract error の business rejection 誤分類
   - 脅威: `E91` / `91` など request contract failure を test-data business rejection と扱い、harness / request contract defect を隠す。
   - 対策: E-prefixed / 91-like result を `request_contract_rejected`、その他未知 non-zero を `unknown_nonzero` に分類。patientlst6v2 の `20` / `21` だけ公式 semantics に分離した。

3. direct_acceptance appointment contract failure false-pass
   - 脅威: direct acceptance flow で予約行が不要という理由により、appointment probe の contract failure まで通してしまう。
   - 対策: direct flow でも probe 実行済みで `request_contract_rejected` / `ambiguous_readiness_failure` / `unknown_nonzero` なら exact preflight を reject。`apiResult=21` の既知 no-row だけ benign absence として扱う。

4. discovery-only artifact authorizing mutation
   - 脅威: candidate discovery summary が Phase 3 mutation の許可証跡として流用される。
   - 対策: discovery gate の `acceptedForPhase3Attempt=false` / `candidateDiscoveryAloneAuthorizesPhase3=false` をテストで固定し、selected proposal があっても exact preflight required に留めた。

## 実装内容

- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
  - insurance readiness を patientlst6v2 semantics に分離。
  - E-prefixed / 91-like / unknown non-zero の request contract 分類を追加。
  - appointment `apiResult=21` を `appointment_row` と `direct_acceptance` で分離。
  - `evaluatePreflightSummary` が rejected appointment dependency を `none` にしないよう hardening。
  - `buildReadinessRejectionReasons` / `primaryReadinessRejectionReason` を追加。

- `web-client/scripts/qa-weborca-candidate-discovery.mjs`
  - candidate row に `primaryRejectionReason`、`rejectionReasons[]`、`readinessAxes` を追加。
  - insurance / appointment blockers を medical information not ready の背後に隠さない順序へ変更。
  - patient-not-found wording 検出で endpoint-specific request contract classification を上書きしないよう修正。

- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
  - exact preflight gate で insurance / appointment の request contract failure を external trial ambiguity として fail closed。
  - direct acceptance でも appointment probe failure は Phase 3 許可にしない。

- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
  - `patientlst6v2 apiResult=E91`、`appointlst2v2 apiResult=91`、direct acceptance contract rejection、known no appointment absence、patientlst6v2 `20` / `21` semantics、multi-dimension `rejectionReasons[]`、zero accepted count、discovery-only Phase 3 non-authorization を追加。

- `docs/runbooks/release-validation.md`
  - read-only insurance / appointment readiness の current contract を更新。

- `docs/releases/orca-remediation-cutover.md`
  - acceptmodv2 `21` と patientlst6v2 `21` の semantics 混同を避ける説明に更新。

## 検証結果

- `npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts`
  - exit code: 0
  - result: 1 file / 76 tests passed

- `npm run ci`
  - exit code: 0
  - result: verify web guard、typecheck、test:ci、build passed
  - test:ci: 185 files / 1242 passed / 2 skipped
  - build warning: Vite chunk size warning only

- UTF-8 BOM check
  - `docs/runbooks/release-validation.md`: first bytes `232052`
  - `docs/releases/orca-remediation-cutover.md`: first bytes `23204f`
  - BOMなしを確認。

## 禁止事項の確認

- Phase 3 は実行していない。
- Phase 4 は実行していない。
- fullflow は実行していない。
- acceptmodv2 mutation / mutation request は実行していない。
- HAR / trace / video / raw screenshots / raw network dump は作成していない。
- raw credential、Cookie、Authorization、JSESSIONID、CSRF、raw ORCA body、患者詳細、保険詳細を artifact / report に出していない。

## 残課題

- なし。live ORCA mutation 系の実行は今回の明示禁止範囲のため未実施。
