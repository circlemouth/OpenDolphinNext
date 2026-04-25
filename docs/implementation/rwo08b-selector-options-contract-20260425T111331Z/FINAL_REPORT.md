# RWO-08B Server-Authoritative Selector Options Contract

RUN_ID: `20260425T111331Z`

## Result

`RWO08B_SELECTOR_OPTIONS_CONTRACT_IMPLEMENTED_NO_LIVE`

This run implemented a server-authoritative department/physician selector options contract for direct patient-search acceptance. The new route is `GET /api/orca/official/appointments/selector-options`; it reads ORCA Trial/system-management options through `/api01rv2/system01lstv2` with allowlisted `Request_Number=01` for departments and `Request_Number=02` for doctors, then returns only code/name option fields to the web client.

No live Trial mutation or diagnostic fullflow was run. Local backend health/readiness were unavailable (`000` / `000`), so exact read-only preflight was skipped as `skipped_environment_unavailable_backend`.

## Public Source Basis

| Source | Scope used |
|---|---|
| ORCA Project API overview: <https://www.orca.med.or.jp/receipt/tec/api/overview.html> | Confirms `/api01rv2/system01lstv2` as the system management information API and lists class `01` as department target, class `02` as doctor target, class `06` as medical-information target. |
| ORCA Project system management detail: <https://www.orca.med.or.jp/receipt/tec/api/systemkanri.html> | Confirms `Request_Number` values `01:診療科情報`, `02:ドクター情報`, and response arrays with `Code` / `WholeName` fields for department and physician options. |

## Implementation

| Area | Change |
|---|---|
| API contract | Added `OrcaReceptionSelectorOptionsResponse` with `departments[]` and `physicians[]`, each restricted to `code` / `name`. |
| Server wrapper | Added `getReceptionSelectorOptions(facilityId)` using system-management requests `01` and `02`; request numbers are allowlisted and unsupported values fail closed. |
| Server REST route | Added authenticated official route `GET /api/orca/official/appointments/selector-options`, with audit details limited to operation, counts, status metadata, and no raw ORCA payload. |
| Parser | Added parser methods for `departmentres.Department_Information[].Code/WholeName` and `physicianres.Physician_Information[].Code/WholeName`. |
| Web client | Reception now fetches selector options from the server and merges them with appointment/visit-row-derived labels; it still does not parse display strings or synthesize selector codes. |
| Tests | Added focused server parser/resource/payload/inventory tests and a reception component test proving direct patient-search acceptance can use server-returned selector options. |

## Trust Boundary

- Accepted: server-returned system-management option DTOs parsed from ORCA `system01lstv2` into allowlisted `code` / `name` fields.
- Rejected: client constants, display-label parsing, hidden DOM values, old diagnostic artifacts, QA defaults, and DOM option injection.
- Fail closed: if the server route is unavailable or options are absent, the existing reception selector gate remains disabled before `acceptmodv2` mutation.

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| User/client supplies a department or physician display string and expects the UI to derive codes. | Existing display-string synthesis test still passes; the new option path requires server-returned code fields. |
| A future developer broadens system-management request classes beyond selector scope. | `buildSystemManagementOptionsPayload` allowlists only `01` through `07`; this route calls only `01` and `02`, with focused payload tests. |
| Direct patient-search acceptance proceeds when no authoritative selector options exist. | Existing fail-closed behavior remains tested; the new positive test succeeds only with server-returned synthetic selector options. |
| Raw ORCA/system-management response details leak to evidence or UI. | DTO and UI consume only `code` / `name`; evidence includes source identity and classifications only. |

## Verification

| Check | Result |
|---|---|
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaAppointmentResourceTest,OrcaLiveGatewaySupportTest,OrcaXmlMapperTypedTextParsingTest,PublicRouteInventoryContractTest -Dsurefire.failIfNoSpecifiedTests=false test` | pass, 29 tests |
| `cd web-client && npm run test -- --run src/features/reception/__tests__/ReceptionPage.test.tsx src/features/reception/__tests__/acceptmodv2.test.ts` | pass, 67 tests |
| `cd web-client && npm run typecheck` | pass |
| `git diff --check` | pass |
| local backend `https://localhost:8443/api/health` / `/api/readiness` | `000` / `000`; exact read-only preflight skipped |

## Claim Boundary

Allowed claim: the repo now has a no-live verified server-authoritative department/physician selector options contract for direct patient-search acceptance.

Not claimed: exact runtime read-only selector preflight pass, diagnostic fullflow pass, Trial `acceptmodv2` mutation success, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness.

## Next Action

Start the approved non-S3 local Trial runtime, rerun exact read-only selector preflight against `GET /api/orca/official/appointments/selector-options`, and only after selector readiness passes consider one diagnostic fullflow retry under the Diagnostic Artifact Exception.
