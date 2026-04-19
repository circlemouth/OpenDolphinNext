# exact-preflight-patientget-agent prompt

RUN_ID: 20260419T220346Z

You are subagent A for OpenDolphinNext ORCA Trial Phase 2.5 exact preflight harness hardening.

Create and work only in your own worktree/branch, for example:
- branch: `codex/orca-exact-preflight-patientget-20260419T220346Z`
- worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-exact-preflight-patientget-20260419T220346Z`

Do not edit `client/` or `server/`. Do not run Python. Do not run Phase 3, Phase 4, fullflow, or any mutation path. Do not include raw ORCA response bodies, raw credentials, cookies, Authorization, JSESSIONID, CSRF, raw session data, raw password, credential-bearing URL, screenshots, HAR, traces, videos, or patient-sensitive details in artifacts.

Task:
Harden exact selected-candidate preflight official patient existence evidence so it aligns with ORCA official patientgetv2 semantics.

Required:
1. Inspect `/api/orca/official/patients/batch` implementation and response shape.
2. If the batch DTO does not retain raw parsed ORCA `Patient_Information` / `Api_Result` / `Patient_ID`, do not use it as exact preflight official patient evidence.
3. For exact preflight, use the same official patientgetv2 parsed ORCA body style as candidate discovery. Underlying ORCA API is `/api01rv2/patientgetv2?id=<patientId>&format=json`; repo proxy path must follow existing design.
4. Ensure `summarizeOfficialPatientExistence` receives a parsed ORCA body containing `Api_Result`, `Patient_Information`, and `Patient_ID` when available.
5. Official patient evidence artifact must include only sanitized fields: `httpStatus`, `parsedOrcaBody`, `apiResult`, `apiResultAccepted`, `patientInformationPresent`, `exactIdMatched`, `notFoundMessage`, `responseCategory`, `rejectionReason`, `evidenceHash`, `rawSensitiveFieldsExcluded=true`.
6. Exact preflight summary must emit machine-readable failure dimensions for 00001-00011 without saying official initial patients do not exist.
7. Exact preflight accepted criteria must require every readiness axis plus `acceptmodv2ReadOnlyDiagnostic.acceptedForPhase3Attempt === true`, `rawSensitiveFieldsExcluded === true`, and summary `acceptedForPhase3Attempt === true`.
8. Preserve artifact path/hash/runId/candidateId/input identity as the only Phase 3 handoff basis.

Tests to add/update:
- batch DTO without `Patient_Information` is not accepted as official patient existence.
- patientgetv2 parsed ORCA body with `Api_Result=00` + `Patient_Information` + exact `Patient_ID` is accepted.
- `Api_Result=10`, missing `Patient_Information`, exact ID mismatch, and patient-not-found wording are rejected.
- exact preflight summary records failure dimensions without raw patient details and never concludes official initial patients are nonexistent.

Report:
Return a concise Japanese worker report with changed files, test commands, exit codes, and any blocker. List the branch and worktree. Do not claim live ORCA success.
