# RWO-08B Authoritative Selector Source Investigation

RUN_ID: `20260425T104330Z`

## Result

`RWO08B_AUTHORITATIVE_SELECTOR_SOURCE_NOT_AVAILABLE_NO_MUTATION`

The active handoff asked for an authoritative runtime source for direct-acceptance department and physician options, or a current Trial precondition carrying appointment/visit-derived selector options.

This run found no implemented server-authoritative direct-acceptance selector source for department/physician options in the current repo. The reception UI builds department and physician options only from server-returned appointment/visit rows and the currently selected row. Patient-search direct acceptance has no selected appointment/visit row, so department/physician options remain empty and the fail-closed selector gate is the correct current behavior.

Existing ORCA master support is limited to `system01lstv2 Request_Number=06` for medical-information options. No current public or official server route exposes department/physician master options for direct acceptance, and the automation did not invent request numbers, use client constants, trust hidden values, or reintroduce selector injection.

## Sanitized Evidence

| Item | Result |
|---|---|
| Branch / HEAD at start | `master` / `3cf3b235f` |
| Active prompt | `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md` |
| Work Order | `RWO-08B` |
| Selector source in UI | appointment/visit rows only; no direct patient-search master source |
| Server medical-information source | `/api/orca/official/appointments/medical-information` -> `system01lstv2 Request_Number=06` |
| Server department/physician source | not implemented in current server route/gateway contract |
| Direct acceptance behavior | fail closed when department/physician options are missing |
| Runtime read-only retry | skipped: local backend unavailable on `https://localhost:8443` |
| Live Trial mutation | not run |
| Business success | `false` |
| Credentials captured | `false` |
| Raw artifacts committed/packaged | `false` |

## Trust Boundary

- Accepted sources: server-returned appointment/visit rows with canonical `departmentCode` / `physicianCode`, and server ORCA wrapper responses parsed into allowlisted DTO fields.
- Rejected sources: client constants, display-label parsing, hidden DOM values, QA environment defaults, old RUN_ID evidence, and injected `<option>` elements.
- Missing behavior: if no server row or future master endpoint supplies the option code, the UI/harness must keep the register action blocked and must not call `acceptmodv2`.

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| Treating display strings like `01 内科` as canonical codes. | Existing `buildDepartmentOptions` and reception tests reject display-only synthesis. |
| Treating QA defaults `departmentCode=01` / `physicianCode=10001` as authoritative. | Rejected; these remain desired input identities only and must match runtime options. |
| Reintroducing DOM option injection to pass fullflow. | Rejected; previous fail-closed harness change remains in place and focused tests pass. |
| Running live mutation without selector readiness. | Not run; local backend was unavailable and selector source remains missing. |

## Verification

| Check | Result |
|---|---|
| `curl -k status-only https://localhost:8443/api/health` | `000`, backend unavailable |
| `curl -k status-only https://localhost:8443/api/readiness` | `000`, backend unavailable |
| `node --check web-client/scripts/qa-fullflow-weborca.mjs` | pass |
| `cd web-client && npm run test -- --run scripts/__tests__/acceptmodv2IdentityGate.test.ts src/features/reception/__tests__/ReceptionPage.test.tsx` | pass, 87 tests |
| `cd web-client && npm run test -- --run src/features/reception/__tests__/acceptmodv2.test.ts` | pass, 18 tests |

## Claim Boundary

Allowed claim: current source review proves the existing direct-acceptance selector blocker is not caused by the QA fullflow harness after the fail-closed repair; the current repo lacks a server-authoritative department/physician master option route for direct patient-search acceptance.

Not claimed: department/physician selector readiness, exact read-only preflight pass, diagnostic fullflow pass, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness.

## Next Action

Implement or specify a safe server-authoritative selector options contract before any new fullflow retry. The next worker should first identify the official ORCA source for department and physician options, then add server DTO/parser/wrapper tests and a public route that emits only allowlisted option code/name fields. Until that exists, RWO-08B remains blocked before mutation.
