# 【ワーカー報告】D docs-route-taxonomy-agent

RUN_ID: `20260419T131740Z`

## 作業範囲

- Worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-docs-route-taxonomy-20260419T131740Z`
- Branch: `codex/docs-route-taxonomy-20260419T131740Z`
- 更新対象:
  - `web-client/scripts/lib/orca-route-taxonomy-guard.mjs`
  - `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts`
  - `docs/contracts/orca-route-taxonomy.md`
  - `docs/runbooks/release-validation.md`
  - `docs/releases/orca-remediation-cutover.md`
  - `docs/runbooks/reviewer-submission-packet.md`
  - `scripts/tools/README.md`

## 脅威 / Misuse Case

1. docs/reference、mock/test fixture、blocked-route detector の literal が public ORCA route または live success route と誤読される。
   - 対策: classifier reason と docs で、これらは reference / detector / fixture であり public-route declaration や success evidence ではないと明記した。
2. candidate discovery の summary だけで Phase 3 mutation 実行が許可される。
   - 対策: release / cutover / reviewer packet docs で、Phase 3 handoff artifact は `qa-weborca-readonly-preflight.mjs` の exact selected-candidate summary のみと固定した。
3. `accepted candidate = 0` が ORCA Trial 公式初期患者の不存在として報告される。
   - 対策: `00001`〜`00011` は official initial data として存在するが current evidence では mutation-ready ではないとし、0 件時は `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` として current harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria の未充足に限定する文言へ修正した。
4. HTTP 200、not-run / not-verified、`apiResult=10/60`、`apiResult=00` with `Request_Number=00`、K1/K2/K3 warning text が mutation success と誤判定される。
   - 対策: endpoint-specific acceptance evidence が必要であり、これら単独では Phase 3 / live success 証跡にしないことを維持・補強した。
5. reviewer packet に raw live evidence、credential、患者機微情報が混入する。
   - 対策: extracted sanitized subset のみ同梱し、credential-bearing URL、Cookie、Authorization、JSESSIONID、CSRF、raw password、患者機微 detail を除外する policy を追加した。

## 実施内容

- route taxonomy classifier の docs/test/script reference reason を hardening し、official/master taxonomy reference を public-route declaration と表現しないよう変更。
- guard test に以下を追加:
  - docs 内 official route reference は `docs/reference` であり public route declaration ではない。
  - `runtime-ready-smoke` の legacy route literal は `blocked-route detector` であり success route ではない。
- route taxonomy docs で public ORCA route contract と retained-string guard categories を分離。
- release validation / cutover docs で discovery は selected-candidate proposal のみ、exact selected-candidate preflight だけが Phase 3 handoff artifact であることを明記。
- `accepted candidate = 0` の意味を、公式初期患者不存在ではなく readiness blocker として明確化。
- reviewer packet runbook と scripts/tools README に extracted subset / sanitization policy を追加。

## 検証結果

- `cd web-client && npx vitest run scripts/__tests__/orcaRouteTaxonomyGuard.test.ts`
  - PASS: 12 tests passed.
- `cd web-client && node scripts/verify-no-blocked-orca-route-strings.mjs`
  - PASS。category counts:
    - production fail-close sentinel=2
    - MSW mock/test-only legacy route surface=2
    - e2e/QA fixture surface=236
    - blocked-route detector=39
    - docs/reference=173
    - server route inventory negative assertion=2
    - web.xml exposure negative assertion=3
- `cd web-client && node --check scripts/lib/orca-route-taxonomy-guard.mjs scripts/verify-no-blocked-orca-route-strings.mjs`
  - PASS.

## 残課題 / 補足

- Phase 3、Phase 4、fullflow、live mutation、mutation scripts は実行していない。
- `client/`、`server/` は編集していない。
- dedicated worktree に `web-client/node_modules` が無かったため `npm ci` を実行した。既存 lock に基づく導入で、依存ファイルは変更なし。npm audit 表示は既存依存の 16 件（low 4、moderate 4、high 7、critical 1）。
