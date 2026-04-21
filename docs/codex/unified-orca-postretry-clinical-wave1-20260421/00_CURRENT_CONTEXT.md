# 00. Current context and non-negotiable facts

## Phase 3 retry status

Phase 3 retry has already been executed once for candidate/patient `00001`.

Reported facts:

- branch / commit: `master / f0e9c92035193a29d8ad9a3897bfc9a08b123ebc`
- exact preflight hash matched: `57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590`
- input identity hash matched: `356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a`
- Phase 3 retry executed once through approved wrapper
- candidateId / patientId: `00001 / 00001`
- apiResult: `K3`
- business classification: `businessAcceptedWithWarnings`
- mutationSuccess: `true`
- C7 dynamic payload gate: `accepted`
- targetMutationRequestCount / checkedRequests: `1 / 1`
- Phase 4: `not_run`
- fullflow: `not_run`
- `00002`〜`00011`: `not_run`

Reference files:

- `references/phase3-retry-20260421T060636Z/final-summary.sanitized.md`
- `references/phase3-retry-20260421T060636Z/phase3-business-evidence.sanitized.json`
- `references/phase3-retry-20260421T060636Z/c7-dynamic-payload-gate.sanitized.json`

## Static failure status after Phase 3 retry

Reported failing commands:

- `npm run typecheck`: FAIL
- `npm run build`: FAIL
- `npm run test:ci`: FAIL

Reported failures include:

- `src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`
  - `TS2322 null not assignable to LetterModulePayload | undefined`
  - `TS2353 readOnly is not a known property`
- `AppRouter.login-redirect.test.tsx`: login-screen not found while facility resolving screen shown
- `WorkspaceTabBar.test.tsx`: timeout failures
- `AdministrationPage.connection.test.tsx`: pushUrl / pushTenantId timeout

## Prior read-only rerun status

Before Phase 3 retry, Mac read-only rerun `20260420T044655Z` showed:

- bootstrap: success
- login `/api/session/me`: 200
- acceptedCandidateCount: `0 / 11`
- Phase 3: not_run
- Phase 4: not_run
- official patientget: all 500/http_not_2xx
- insurance/appointment: all 403 ambiguous_readiness_failure

Reference:

- `references/readonly-rerun-20260420T044655Z/final-summary.sanitized.md`

## Absolute prohibitions for this unified plan

- Do not rerun Phase 3.
- Do not run Phase 4.
- Do not run fullflow.
- Do not send any additional live ORCA mutation.
- Do not mutate `00002`〜`00011`.
- Do not replay old mutation artifacts.
- Do not store raw ORCA request/response bodies.
- Do not store raw patient/insurance details.
- Do not store raw credentials, cookies, Authorization, JSESSIONID, CSRF token values, raw sessions, passwords, credential-bearing URLs.
- Do not include HAR, traces, videos, raw screenshots, raw network dumps.
- Do not treat not_run / not_verified as success.
