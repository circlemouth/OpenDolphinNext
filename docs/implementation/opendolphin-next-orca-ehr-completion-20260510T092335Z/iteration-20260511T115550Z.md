# Worker E Iteration 20260511T115550Z

## Start Check

- RUN_ID: `20260511T115550Z`
- Worktree: `/Users/Hayato/.codex/worktrees/opendolphinnext-orca-ehr-r2-worker-e/OpenDolphin_WebClient`
- Branch: `codex/orca-ehr-r2-worker-e-safety-ui`
- Start status: clean
- Start HEAD: `1c38e90bd`

## Required Reading

- Workstream: `README.md`, `parallel-heartbeat-plan.md`, `worker-board.md`, `opendolphin-next-orca-ehr-implementation-checklist.md`
- Current docs: `docs/README.md`, `docs/managerdocs/README.md`, `web-client/README.md`
- Architecture/runbook: `docs/architecture/server-modernization-overview.md`, `docs/runbooks/release-validation.md`
- UI/security contracts: `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`, `docs/web-client/ux/web-client-ui-guideline.md`, `web-client/notes/ui-current-contract.md`, `web-client/notes/security-spec.md`

## Scope

One-heartbeat slice for checklist 11 / Phase 4: extend the common medical-safety patient header context in Patients detail view. This remains UI patient-identification and synchronization-status support only; server-side ORCA source authority, authorization, and persistence enforcement remain backend-owned.

## Assets, Trust Boundary, Attack Surface

- Assets: selected Patients detail identity, patient master form values, encounter/schedule/reception/appointment references, visit date, department, physician, insurance combination, and Patients ORCA synchronization status.
- Trust boundary: location state, volatile encounter memory, query/carryover state, and form state are browser-controlled and non-authoritative. Server APIs remain authoritative for ORCA official read/write, patient local sync, authorization, and persistence.
- Attack surface: stale encounter context appearing on a different selected patient, forged department/physician/insurance context being treated as ORCA authority, sync failure displayed as sync success, and tracked evidence leaking credentials/raw ORCA bodies/PHI/artifacts.

## Misuse Cases

1. A user enters Patients from one patient context, then selects another patient and the old encounter/schedule/department/insurance context remains visible. Mitigation: medical-safety encounter meta is displayed only when the context patientId matches the selected patientId.
2. A client tampers `location.state.encounter.departmentCode`, `physicianCode`, or `insuranceCombinationNumber` and the UI presents it as authoritative. Mitigation: the header labels the values as visible context only and docs state Patients UI does not replace server-side authority.
3. ORCA canonical refetch or master data is missing, but the header appears to say synchronization is complete. Mitigation: the header maps current UI state to `missing`, `stale`, `fresh`, or `unverified`; unsent/default state is `unverified`, not confirmed.
4. Evidence files or tests leak raw ORCA data, credentials, PHI, HAR, trace, video, or screenshots. Mitigation: no such tracked artifacts were added; tests use existing synthetic patient fixtures.

## Implementation

- `web-client/src/features/patients/PatientsPage.tsx`
  - Normalizes the incoming/stored encounter context with `normalizeEncounterContext`.
  - Adds internal reference, visit date, department, physician, insurance combination, and Patients synchronization status to the existing `PatientIdentityBar`.
  - Suppresses encounter-derived medical-safety meta when the context patientId does not match the selected patient.
- `web-client/src/features/patients/__tests__/PatientsPage.test.tsx`
  - Verifies matched encounter context is visible in the common medical-safety patient header.
  - Verifies mismatched encounter context is not mixed into the selected patient header.
- `web-client/notes/ui-current-contract.md`
  - Documents the Patients header context contract and server-authority boundary.
- `opendolphin-next-orca-ehr-implementation-checklist.md`, `worker-board.md`
  - Recorded this heartbeat slice.

## Verification

- `cd web-client && npm test -- --run src/features/patients/__tests__/PatientsPage.test.tsx`
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `git diff --check`

Browser/a11y verification was not run because this was a focused header-context composition change covered by role/label assertions in Vitest. No screenshot, trace, video, HAR, raw ORCA body, credential, or PHI evidence was produced.
