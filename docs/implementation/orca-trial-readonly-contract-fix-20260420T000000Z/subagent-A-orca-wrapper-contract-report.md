# Subagent A ORCA read-only wrapper contract report

- RUN_ID: `20260420T114112Z`
- Worktree: `/Users/Hayato/Documents/GitHub/opendolphin-subagent-orca-wrapper-contract`
- Branch: `codex/subagent-orca-wrapper-contract-20260420`
- Scope: ORCA read-only wrapper request contract for insurance combinations and patient appointment list.

## Threat model before editing
1. Malformed ORCA request contract can cause false business rejection: `patientlst6v2` with a local wrapper root or `Perform_Date`, and `appointlst2v2` without `class=01`, can be rejected as no data or contract error even when the patient data is valid.
2. Raw ORCA response leakage can expose patient or insurance details: tests and reports must use synthetic IDs and must not persist raw ORCA bodies, credentials, cookies, Authorization, JSESSIONID, CSRF, patient detail, or insurance detail.
3. Read-only diagnostics can accidentally escalate into mutation routes: Phase 3, Phase 4, fullflow, `acceptmodv2`, and other mutation requests must not be run for this contract fix.

## Implemented changes
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaLiveGatewaySupport.java`
  - `patientlst6v2` request XML now uses official root `patientlst6req`.
  - Emits `Reqest_Number=01`, `Patient_ID`, `Base_Date`, `Start_Date`, and `End_Date`.
  - Removed upstream `insurancecombinationreq` and `Perform_Date` for this endpoint.
  - `appointlst2v2` payload now carries `class=01` via wrapper meta and emits only `Patient_ID` and `Base_Date`.
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaEndpoint.java`
  - `PATIENT_APPOINTMENT_LIST` now allows query extraction from payload meta so transport sends `?class=01`.
  - `INSURANCE_COMBINATION` required field guard now matches the official `patientlst6v2` request fields.
- `server-modernized/src/main/java/open/dolphin/orca/service/DefaultOrcaLiveGateway.java`
  - `Department_Code` is no longer sent upstream for patient appointment list.
  - If wrapper callers provide `departmentCode`, filtering is applied locally after parsing ORCA response data.
- `server-modernized/src/test/java/open/dolphin/orca/service/OrcaLiveGatewaySupportTest.java`
  - Added direct payload assertions for `patientlst6req`, `Reqest_Number`, `Base_Date`, `Start_Date`, `End_Date`, and `appointlst2req`.
  - Added negative assertions for `insurancecombinationreq`, `Perform_Date`, and upstream `Department_Code`.
- `server-modernized/src/test/java/open/dolphin/orca/service/OrcaLiveGatewayReadOnlyContractPayloadTest.java`
  - Added transport-level capture tests for endpoint selection and generated read-only payloads.
- `server-modernized/src/test/java/open/dolphin/orca/transport/OrcaEndpointStubResourceTest.java`
  - Added endpoint/stub assertions for `appointlst2v2` class-query handling and `patientlst6v2` stub resolution.
- `docs/operations/ORCA_CERTIFICATION_ONLY.md`
  - Added official read-only wrapper contract notes and artifact/log redaction reminders.
- `docs/README.md`, `docs/implementation/README.md`
  - Added index links to this Subagent A report.

## Tests run
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaLiveGatewaySupportTest,OrcaLiveGatewayReadOnlyContractPayloadTest,OrcaEndpointStubResourceTest,OrcaAppointmentResourceTest,OrcaPatientBatchResourceTest test`
  - Exit code: `0`
  - Result: `Tests run: 34, Failures: 0, Errors: 0, Skipped: 0`
- `rg -n "insurancecombinationreq|<Perform_Date>|query=class=01|appointlst2v2|patientlst6req|Reqest_Number" server-modernized/src/main/java/open/dolphin/orca server-modernized/src/test/java/open/dolphin/orca docs/operations/ORCA_CERTIFICATION_ONLY.md`
  - Exit code: `0`
  - Result: expected production hits only for the new official contract; `insurancecombinationreq` / `Perform_Date` remain only in docs or negative test assertions for this scope.
- `file docs/operations/ORCA_CERTIFICATION_ONLY.md && xxd -l 3 docs/operations/ORCA_CERTIFICATION_ONLY.md`
  - Exit code: `0`
  - Result: UTF-8 text, no BOM (`23 20 4f`).
- `git diff --check`
  - Exit code: `0`
  - Result: no whitespace errors.

## Not run
- Phase 3: not run.
- Phase 4: not run.
- fullflow: not run.
- `acceptmodv2` mutation: not run.
- Any mutation request: not run.
- HAR/trace/video/raw screenshots/raw network dumps: not generated.

## Security notes
- No raw ORCA request/response bodies were written to artifacts.
- No raw credentials, cookies, Authorization, JSESSIONID, CSRF token, raw patient detail, or raw insurance detail were added to code, tests, docs, or report.
- Tests use synthetic IDs only and assert generated XML strings without live ORCA calls.

## Residual risk
- This branch fixes request contract generation and focused regression coverage only. Live WebORCA Trial read-only verification should be performed by the designated read-only preflight workflow, without mutation or fullflow execution.
