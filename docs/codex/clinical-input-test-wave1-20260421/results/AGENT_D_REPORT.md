# Agent D: DADS UI contract and dynamic evidence packaging tests

## Agent identity

```text
agent id: Subagent D
model: gpt 5.4 high
worktree path: /Users/Hayato/Documents/GitHub/odn-wave1-agent-d
branch name: codex/wave1-agent-d-dads-evidence-tests
base branch: 02aa1434d20615c22c23fe5cbf80938e725cfd88
base commit: 02aa1434d20615c22c23fe5cbf80938e725cfd88
start time: 2026-04-21T04:49:25Z
end time: 2026-04-21T05:12:37Z
RUN_ID: 20260421T044925Z
```

## Forbidden-action attestation

```text
external web used: no
live ORCA mutation: no
Phase 3/4/fullflow: no
production code changed: no
raw HAR/trace/video/screenshot included: no
client/ legacy changed: no
server/ legacy changed: no
Python executed: no
```

Agent D did not perform live ORCA mutation; UI/MSW evidence is not live ORCA evidence.

## DADS bases used

| DADS basis | Covered by | Notes |
|---|---|---|
| important information not hidden | `dadsClinicalInputContract.test.tsx` | 活動中病名の病名名、主/副、開始、転帰、終了、コード状態、ORCA mirror 参照専用表示を確認。 |
| label/support text/error text | `dadsClinicalInputContract.test.tsx` | 病名・文書の現行ラベルと文書必須エラーを確認。SOAP/Disease/Document の不足は blocker に記録。 |
| placeholder not used as substitute | `dadsClinicalInputContract.test.tsx`, blocker | date input は placeholder 非依存を確認。SOAP textarea と文書/病名 text input は blocker。 |
| disabled avoided or reason/enabling condition nearby | `dadsClinicalInputContract.test.tsx` | SOAP read-only、病名 read-only の visible reason / enabling direction を確認。 |
| one primary action per screen/context | `dadsOrderContract.test.ts` | OrderBundle / Prescription footer の `--save` token が各 footer 1 件であることを source-level 固定。 |
| button order and hierarchy | `dadsOrderContract.test.ts` | save / expand / expand_continue の visual token 差分と shortcut helper を固定。 |
| date input guidance | partial + blocker | date input の label/type/no-placeholder は確認。西暦例などの support text は blocker。 |
| error text concrete and static | partial + blocker | 文書必須エラーの具体性を確認。`role=alert`/`aria-live=assertive` 利用は blocker。 |
| accessibility/focus/contrast if source supports checking | partial | role/name query と visible text を使用。contrast は runtime/browser 未検証。 |

## Scope completed

| Item | Status | Notes |
|---|---:|---|
| SOAP disabled controls visible reason | done | read-only reason が title-only ではなく visible guard として出ることを確認。 |
| SOAP textarea label/support contract | blocker recorded | textarea に `<label>` / `aria-describedby` がなく placeholder guidance 依存。production UI は変更せず記録。 |
| Disease active status visibility | done | 活動中病名の開始/転帰/終了/コード状態を visible DOM で確認。 |
| Disease disabled controls reason | done | read-only block reason と解除方向を visible text で確認。 |
| Disease date guidance | partial | date input の label/type/no-placeholder は確認。西暦例/support text 不足は blocker。 |
| Document labels/errors | partial | 紹介状フォームの labels と具体的必須エラーを確認。placeholder/support/alert 利用は blocker。 |
| Order primary action hierarchy | done | OrderBundle / Prescription footer の strongest save token が 1 件であることを固定。 |
| Patient identity in save contexts | not done | `PatientIdentityBar` 単体は既存だが、chart/order/document save context への組込み runtime は未検証。 |
| Playwright/MSW live boundary | done | Playwright は追加・実行せず、UI evidence を live ORCA と表現しない境界を report に明記。 |
| Dynamic evidence packaging | done | sanitized command summary acceptance と raw artifact/env rejection を追加。 |

## Changed files

| File | Type | Reason |
|---|---|---|
| `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | test | SOAP / Disease / Document の DADS clinical input contract を component/DOM test 化。 |
| `web-client/src/features/charts/__tests__/dadsOrderContract.test.ts` | test | order editor footer の primary action hierarchy を source-level test 化。 |
| `tests/review-package/dynamicEvidencePackaging.test.mjs` | test | sanitized dynamic command summary を許可し、raw trace/HAR/screenshot/raw-network/raw-xml/env を reject。 |
| `tests/review-package/create-review-package.test.mjs` | test | review package が `*.env` と `raw-xml/` を含めないことを既存 packaging test に追加。 |
| `scripts/create-review-package.sh` | utility | review package source/manifest inclusion から `.env`, `*.env`, `raw-network/`, `raw-xml/` を除外。 |
| `scripts/tools/scan-review-bundle.mjs` | utility | final bundle scan で `.env`, `*.env`, `raw-network/`, `raw-xml/` を reject。 |
| `docs/codex/clinical-input-test-wave1-20260421/results/AGENT_D_REPORT.md` | doc | Agent D の結果、blocker、commands、ORCA boundary を記録。 |

## Tests added

| Test file | Test name | Purpose | Boundary |
|---|---|---|---|
| `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | `read-only SOAP controls expose a visible disabling reason instead of title-only guidance` | SOAP read-only disabled reason が visible であることを確認。 | local DOM |
| `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | `keeps clinically important diagnosis state visible in active disease rows` | 活動中病名の状態・ORCA mirror 参照専用・date no-placeholder を確認。 | local DOM |
| `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | `shows a visible reason and enabling direction when disease editing is blocked` | 病名編集 block reason と解除方向を確認。 | local DOM |
| `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | `exposes document labels and concrete ordinary validation text for the current referral form` | 文書 labels と具体的必須エラーを確認。 | local DOM |
| `web-client/src/features/charts/__tests__/dadsOrderContract.test.ts` | `keeps one visually strongest save action in the general order editor footer` | OrderBundle footer の strongest action 1 件を固定。 | static/source |
| `web-client/src/features/charts/__tests__/dadsOrderContract.test.ts` | `keeps one visually strongest save action in the prescription order editor footer` | Prescription footer の strongest action 1 件を固定。 | static/source |
| `web-client/src/features/charts/__tests__/dadsOrderContract.test.ts` | `maps the strongest order action to a distinct filled visual token` | primary/secondary token 差分を固定。 | static/source |
| `tests/review-package/dynamicEvidencePackaging.test.mjs` | `review bundle scan accepts sanitized dynamic command summaries without raw artifact evidence` | sanitized command summary allowlist を確認。 | static/package |
| `tests/review-package/dynamicEvidencePackaging.test.mjs` | `review bundle scan rejects raw dynamic evidence paths and env files` | raw artifact/env rejection を確認。 | static/package |

## Commands run

| Command | CWD | Result | Exit code | Output summary |
|---|---|---:|---:|---|
| `npm test -- --run src/features/charts/__tests__/dadsClinicalInputContract.test.tsx src/features/charts/__tests__/dadsOrderContract.test.ts` | `web-client` | FAIL | 127 | 初回は `vitest: command not found`。`web-client/node_modules` 未導入。 |
| `node --test tests/review-package/dynamicEvidencePackaging.test.mjs` | repo root | FAIL | 1 | 初回は `raw-network/` が scan reject されず、utility gap を検出。 |
| `npm ci` | `web-client` | PASS | 0 | Vitest 実行に必要な dependencies を導入。 |
| `node --test tests/review-package/dynamicEvidencePackaging.test.mjs` | repo root | PASS | 0 | 2 tests pass。sanitized summary acceptance と raw artifact/env rejection。 |
| `npm test -- --run src/features/charts/__tests__/dadsClinicalInputContract.test.tsx src/features/charts/__tests__/dadsOrderContract.test.ts` | `web-client` | FAIL | 1 | 2 tests failed。SOAP status expectation と文書 error message matcher が現行 DOM と不一致。テスト側を修正。 |
| `npm test -- --run src/features/charts/__tests__/dadsClinicalInputContract.test.tsx src/features/charts/__tests__/dadsOrderContract.test.ts` | `web-client` | PASS | 0 | 2 files / 7 tests pass。pretest web-guard も PASS。 |
| `node --test tests/review-package/create-review-package.test.mjs` | repo root | PASS | 0 | 22 tests pass。env/raw-xml exclusion の既存 packaging regression を含む。 |
| `node --test tests/review-package/dynamicEvidencePackaging.test.mjs` | repo root | PASS | 0 | raw-xml 追加後も 2 tests pass。 |
| `node --test tests/review-package/create-review-package.test.mjs` | repo root | PASS | 0 | raw-xml 追加後も 22 tests pass。 |

## Not-run commands

| Command or suite | Reason |
|---|---|
| Playwright E2E | Stable narrow component/static testsで目的を満たしたため追加せず。Playwright config は failure 時 trace/screenshot を保持するため、raw artifact 禁止範囲では今回不使用。 |
| live ORCA / Phase 3 / Phase 4 / fullflow | Wave 1 forbidden action。 |
| `npm run ci` / full server Maven suite | Agent D scope は targeted DADS/evidence tests。full aggregate は coordinator merge 後に再実行する前提。 |

## Failures / blockers

| Blocker id | Severity | Area | Description | Proposed next action |
|---|---:|---|---|---|
| DADS-D-001 | High | SOAP | SOAP textareas は visible section title はあるが、textarea 自体に `<label>` / `aria-label` / `aria-describedby` がなく、placeholder が主な入力 guidance になっている。DADS の「ラベル必須」「サポートテキストを placeholder で代用しない」に未達。 | Follow-up production UI package で textarea ごとに real label/support text/error slot を追加し、placeholder を削除または非 guidance 化する。 |
| DADS-D-002 | Medium | Disease | date inputs は `type=date` かつ no-placeholder だが、西暦例・入力条件の visible support text が不足。転帰あり病名は `details` 配下で折りたたまれ、臨床上重要な終了/転帰状態の初期可視性は要判断。 | Follow-up で date guidance を追加し、終了/転帰病名の初期表示方針を臨床 UI として決める。 |
| DADS-D-003 | High | Document | 多くの document text fields / textareas が placeholder examples に依存している。ordinary validation notice は具体的だが `role=alert` / `aria-live=assertive` を使用しており、DADS の「通常エラーは静的表示、読み上げ強制しない」に未達。 | Follow-up で field-level support text と static error rendering へ移行する。 |
| DADS-D-004 | Medium | Order | Footer primary action hierarchy は source-level 固定できたが、すべての disabled controls の nearby reason/enabling condition は未網羅。OrderBundle には disabled 操作が多く、タイトルのみの理由が残る可能性がある。 | Follow-up で order editor disabled controls を role/name query で runtime 網羅し、reason/enabling condition を visible text に寄せる。 |
| DADS-D-005 | Medium | Clinical context | PatientIdentityBar 単体実装は存在するが、chart/order/document save contexts で患者識別帯が必ず見えることは今回未検証。 | Follow-up で save/send context ごとに patient identity visible contract を追加する。 |

## Evidence packaging assertions

| Assertion | Status | Evidence |
|---|---:|---|
| Sanitized command summary can be included | done | `dynamicEvidencePackaging.test.mjs` accepts JSON with command/cwd/runId/timestamp/exit_code/result/test_count/redacted_environment_summary and explicit non-live-ORCA boundary. |
| HAR/trace/video/screenshots/raw-network/raw-xml/env are rejected | done | `dynamicEvidencePackaging.test.mjs`, `scan-review-bundle.mjs`, `create-review-package.sh`, existing `create-review-package.test.mjs`. |
| Review package does not claim clean checkout/full source secret scan/live ORCA from dynamic evidence | done | Existing `create-review-package.test.mjs` remains PASS and validates non-guarantee scope / package sidecar semantics. |
| Playwright/MSW evidence is not live ORCA evidence | done | Report boundary statement; no Playwright run added. |

## ORCA boundary statement

```text
Agent D did not perform live ORCA mutation; UI/MSW evidence is not live ORCA evidence.
```

## Merge recommendation

merge as-is.

Rationale: targeted DADS/evidence tests and packaging utility hardening pass locally. Remaining DADS issues are production UI blockers intentionally not fixed in Wave 1 per scope; they are recorded above for follow-up implementation.
