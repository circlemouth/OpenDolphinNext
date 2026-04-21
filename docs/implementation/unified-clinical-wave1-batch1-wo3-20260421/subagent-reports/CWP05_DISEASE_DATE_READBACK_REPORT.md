# CWP05 disease date/readback validation report

## subagent id
CWP-05 disease date/readback validation

## local worktree path(reference only)
`/Users/Hayato/Documents/GitHub/odn-cwp05-disease-date-readback`

## base commit
`672c37c7e15a8247c950b9f27f378ad3eeb30039`

## branch
`codex/cwp05-disease-date-readback`

## scope
- disease/diagnosis local persistence
- `yyyy-MM-dd` startDate/endDate save-readback
- invalid date validation
- endDate before startDate validation
- unknown outcome validation
- add/edit/delete/outcome readback
- suspected/principal save-readback-edit badge retention
- ORCA mirror / candidate mutation boundary
- diseasev3 DTO/static route: not changed

## changed files(repo-relative only)
- `server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java`
- `web-client/src/features/charts/diseaseApi.ts`
- `web-client/src/features/charts/diseaseApi.test.ts`
- `web-client/src/features/charts/DiagnosisEditPanel.tsx`
- `web-client/src/features/charts/__tests__/DiagnosisEditPanel.test.tsx`

## local commands run(command + exit code only)
- `date -u +%Y%m%dT%H%M%SZ` -> exit 0
- `git rev-parse HEAD && git status --short && git worktree list --porcelain` -> exit 0
- `git worktree add -b codex/cwp05-disease-date-readback ../odn-cwp05-disease-date-readback 672c37c7e15a8247c950b9f27f378ad3eeb30039` -> exit 0
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalDiagnosisResourceTest test` -> exit 0
- `npm test -- --run src/features/charts/diseaseApi.test.ts src/features/charts/__tests__/DiagnosisEditPanel.test.tsx` -> exit 127
- `npm ci` -> exit 0
- `npm test -- --run src/features/charts/diseaseApi.test.ts src/features/charts/__tests__/DiagnosisEditPanel.test.tsx` -> exit 1
- `npm test -- --run src/features/charts/diseaseApi.test.ts src/features/charts/__tests__/DiagnosisEditPanel.test.tsx` -> exit 0
- `npm run typecheck` -> exit 0
- `git diff --check` -> exit 0
- `git status --short` -> exit 0
- `git diff --name-only` -> exit 0
- `git rev-parse HEAD && git branch --show-current` -> exit 0

## local logs(reference only)
- Codex terminal output in the local worktree only. No raw ORCA body, raw patient/insurance detail, credentials, cookies, Authorization, JSESSIONID, CSRF, HAR, trace, video, screenshot, or raw network dump was generated or included.

## implementation summary
- Server local diagnosis mutation now parses `startDate`/`endDate` as strict date-only `yyyy-MM-dd`; invalid or impossible dates fail closed with HTTP 400 instead of persisting null.
- Server rejects `endDate` before `startDate` with HTTP 400.
- Server rejects unknown `outcome` values; allowed values are `継続`, `治癒`, `中止`, `再発`, `死亡`, `転院`, `不明`.
- Existing ORCA mirror/candidate mutation boundary remains server-enforced: non-`insurance-local` layer and `candidateOnly=true` authoring are rejected.
- Web disease mutation now validates date-only values, end-date ordering, and unknown outcome before sending local mutation requests.
- Web disease mutation payload is sanitized to local diagnosis mutation fields only, so read-only/mirror/candidate metadata is not forwarded as authority.
- DiagnosisEditPanel date fields now have visible required/optional labels and concrete date support text based on the bundled DADS reference, without adding `role="alert"` or assertive live region for ordinary validation errors.
- DiagnosisEditPanel tests now verify create readback, delete readback, outcome/date display, suspected/principal badge retention through edit dialog, ORCA mirror read-only boundary, and candidate explicit-add boundary.

## test coverage summary
- Server: `LocalDiagnosisResourceTest` covers date-only save/readback, invalid date HTTP 400, endDate-before-startDate HTTP 400, unknown outcome HTTP 400, create/update/delete, suspected/principal/outcome readback, and ORCA mirror/candidate rejection.
- Web API: `diseaseApi.test.ts` covers date-only mutation payload, invalid date rejection, endDate-before-startDate rejection, unknown outcome rejection, and payload sanitization for mirror/candidate metadata.
- Web component: `DiagnosisEditPanel.test.tsx` covers server reload/readback after add/delete, outcome/date rendering, suspected/principal badge retention in edit dialog, mirror read-only UI, candidate explicit add, and concrete validation errors before mutation.

## risks/blockers
- `npm test` initially failed with exit 127 because `vitest` was not installed in this fresh worktree; `npm ci` restored dependencies from the existing lockfile.
- The first post-install component test run failed due to a component-side date regex capture bug introduced during implementation; fixed and rerun successfully.
- `npm ci` reported 4 low severity audit findings from existing dependency graph. No dependency was added or updated.
- Browser runtime, Playwright/e2e, live diseasev3, Phase 3 retry, Phase 4, fullflow, and live ORCA mutation were not run and are not verified.

## recommended main-worktree verification commands
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalDiagnosisResourceTest test`
- `cd web-client && npm test -- --run src/features/charts/diseaseApi.test.ts src/features/charts/__tests__/DiagnosisEditPanel.test.tsx`
- `cd web-client && npm run typecheck`
- `git diff --check`

## raw artifact inclusion
none

## live ORCA mutation
not run

## Phase 3/Phase 4/fullflow
not run
