# Worker B iteration 20260511T125522Z

## Scope
- Queue: B-05 follow-up, checklist 14 / 19 period export parity.
- Slice: patient/date/period chart revision export surface using the existing sanitized chart export projection.
- Out of scope: patient/acceptance/insurance authority, prescription authority, live ORCA transport evidence, and authorization matrix/guard ownership.

## Pre-flight
- Worktree: `/Users/Hayato/.codex/worktrees/opendolphinnext-orca-ehr-r2-worker-b/OpenDolphin_WebClient`
- Branch: `codex/orca-ehr-r2-worker-b-chart-export`
- Start HEAD: `4ddefbc7a`
- Start status: clean

## Assets / trust boundary / attack surface
- Assets: period export response, per-chart export hash, chart revision/prescription/ORCA provenance, snapshot manifest references, date range query, patient filter.
- Trust boundary: request query parameters are filters only. Facility boundary and chart contents are resolved server-side from the authenticated session and DB.
- Attack surface: guessed patient/chart identifiers, excessive date range export, raw ORCA/credential/PHI leakage through aggregated exports, CSV spreadsheet injection, and export hash drift between single-chart and period outputs.

## Misuse cases
1. Caller asks for another facility's chart through a period query.
   - Mitigation: period query filters `chart_document.facility_id` by server-side session facility, and every returned chart is exported again through the single-chart facility guard.
2. Caller requests a very large date range to bulk export data accidentally or abusively.
   - Mitigation: `fromDate` / `toDate` are required and the range is capped at 366 days.
3. Caller injects formula text, raw XML, Authorization, Cookie, or allowlist-excluded fields into revision/event summaries.
   - Mitigation: period CSV reuses the single-chart CSV writer with formula neutralization; JSON entries reuse the sanitized export projection.
4. Caller uses patient filter as authority.
   - Mitigation: patient filter only narrows DB rows inside the authenticated facility; it is not used as owner/facility authority and is not copied as patient detail into export hash material.

## Implementation
- Added `ChartRevisionPeriodExportResponse`.
- Added `ChartRevisionExportService.exportChartPeriod` and `exportChartPeriodCsv`.
- Added `GET /api/charts/revision-exports` and `GET /api/charts/revision-exports.csv`.
- Period export hash covers date range, patient-filter presence, chart count, and each chart's `chartId` / `currentRevisionId` / per-chart `exportHash`.
- Refactored CSV generation so single-chart and period CSV use the same redaction/formula-neutralization path.

## Verification
- PASS: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=ChartRevisionExportServiceTest,PublicRouteInventoryContractTest test`
- PASS: `mvn -f pom.server-modernized.xml -pl reporting -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=ReportingChartRevisionEventTest,PdfSigningServiceTest test`
- PASS: `bash server-modernized/tools/ci/check-doc-links.sh`
- PASS: `bash server-modernized/tools/ci/check-config-contract.sh`
- PASS: `bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"`
- PASS: `bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"`
- PASS: `git diff --check`

## Sanitization
- No raw ORCA body, credential, Cookie, Authorization value, HAR, trace, video, screenshot, real PHI, idempotency key, request body, or response body was added to tracked files.
- Tests use fictional patient data only where existing PDF rendering requires a patient header.

## Follow-up
- Worker B should next coordinate with Worker F for authoritative audit-log integration gaps rather than implementing authorization matrix/guard behavior in this branch.
