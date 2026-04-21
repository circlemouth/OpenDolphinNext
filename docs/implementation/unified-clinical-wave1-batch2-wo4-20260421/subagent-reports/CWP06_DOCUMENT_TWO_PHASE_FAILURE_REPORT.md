# CWP-06 Document Two-Phase Failure Report

## subagent id
CWP-06 document two-phase failure

## local worktree path
Reference only: `/Users/Hayato/Documents/GitHub/odn-cwp06-document-two-phase-failure`

## base commit
`40737ebca3b71fc86968467257fbcc8a9c8d9f29`

## branch
`codex/cwp06-document-two-phase-failure`

## scope
- document attachment two-phase failure semantics for `/karte/document` success followed by `/odletter/letter` failure.
- Failure must not silently lose local edits or selected image references.
- Retry must not double-post the successful document attachment reference phase for the same patient/form/attachment fingerprint.
- Failed letter/history reference phase remains dirty and recoverable.
- Free document save/readback/patient switch minimum coverage.
- Local/component/static coverage only.
- No live ORCA mutation.

## changed files
- `web-client/src/features/charts/DocumentCreatePanel.tsx`
- `web-client/src/features/charts/__tests__/documentCreatePanel.test.tsx`
- `web-client/src/features/charts/__tests__/PatientSummaryPanel.test.tsx`
- `web-client/src/features/charts/patientFreeDocumentApi.test.ts`
- `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-reports/CWP06_DOCUMENT_TWO_PHASE_FAILURE_REPORT.md`

## local commands run
- `date -u +%Y%m%dT%H%M%SZ` - exit 0
- `git status --short && git rev-parse HEAD && git branch --show-current && git worktree list --porcelain` - exit 0
- `sed -n '1,240p' /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wo4-clinical-wave1-batch2-main/docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-prompts/CWP06_DOCUMENT_TWO_PHASE_FAILURE_PROMPT.md` - exit 0
- `git worktree add -b codex/cwp06-document-two-phase-failure /Users/Hayato/Documents/GitHub/odn-cwp06-document-two-phase-failure 40737ebca3b71fc86968467257fbcc8a9c8d9f29` - exit 0
- `sed -n '1,220p' docs/README.md` - exit 0
- `sed -n '1,220p' docs/managerdocs/README.md` - exit 0
- `sed -n '1,220p' web-client/README.md` - exit 0
- `sed -n '1,220p' docs/web-client/ux/dads_app_ui_design_rules_20260411.md` - exit 0
- `sed -n '1,220p' docs/web-client/ux/web-client-ui-guideline.md` - exit 0
- `sed -n '1,240p' docs/architecture/server-modernization-overview.md` - exit 0
- `sed -n '1,240p' docs/runbooks/release-validation.md` - exit 0
- `rg -n "save|sendKarteDocumentWithAttachments|saveLetterModule|attachment|dirty|setError|error" web-client/src/features/charts/DocumentCreatePanel.tsx` - exit 0
- `npm test -- --run src/features/charts/__tests__/documentCreatePanel.test.tsx src/features/charts/__tests__/PatientSummaryPanel.test.tsx src/features/charts/patientFreeDocumentApi.test.ts` - exit 127
- `npm ci` - exit 0
- `npm test -- --run src/features/charts/__tests__/documentCreatePanel.test.tsx src/features/charts/__tests__/PatientSummaryPanel.test.tsx src/features/charts/patientFreeDocumentApi.test.ts` - exit 0
- `npm run typecheck` - exit 0
- `npm run lint -- src/features/charts/DocumentCreatePanel.tsx src/features/charts/__tests__/documentCreatePanel.test.tsx src/features/charts/__tests__/PatientSummaryPanel.test.tsx src/features/charts/patientFreeDocumentApi.test.ts` - exit 0
- `npm run build` - exit 0

## local logs
Reference only: terminal output in this worktree. No report log artifact is final evidence.

## implementation summary
- Added an in-memory pending first-phase record for attachment-backed document saves.
- The pending record is keyed by patient id, document type, title, issued date, template id, editing letter id, and attachment metadata.
- When `/karte/document` succeeds and `/odletter/letter` fails, the UI keeps the form and selected attachments, marks the save retryable, and shows a concrete static notice naming the successful phase, failed phase, and retry behavior.
- A retry with the same fingerprint reuses the successful `documentId` and only retries `/odletter/letter`; it does not call `sendKarteDocumentWithAttachments` again.
- Form edits, attachment removal/clear, patient changes, copy/edit mode changes, cancel, and successful save clear the pending first-phase record.

## test coverage summary
- Component test fixes the two-phase failure case: `/karte/document` returns `docPk`, `/odletter/letter` returns 500, local edits and attachment selection remain visible, retry reuses `webDocumentId`, and `/karte/document` is called only once.
- Component test covers required date validation.
- Patient summary component tests cover free document save and patient switch draft isolation.
- API tests cover free document 404 unsupported fetch/save behavior without raw response leakage.
- `npm test -- --run ...` passed: 3 files, 26 tests.
- `npm run typecheck` passed.
- `npm run lint -- ...` passed with existing repo-wide warnings and no errors.
- `npm run build` passed.

## misuse cases considered
- User retries after `/karte/document` success and `/odletter/letter` failure: retry reuses first-phase `documentId` and avoids duplicate attachment document creation.
- User changes form or attachment selection after a two-phase failure: pending first-phase state is cleared, so stale document references are not silently reused.
- User switches patient after a free document draft edit: draft state is reset and readback is scoped to the new patient query.

## risks / blockers
- Main merge is intentionally blocked until CWP-04 and CWP-03 land; rebase and rerun targeted verification after those merges.
- This is client-side retry idempotency for the current two-step UI flow. Server-side compensation/cleanup for orphaned `/karte/document` rows remains a broader contract decision if product requires automatic cleanup after abandoned retries.
- `npm ci` created ignored local dependency files; `npm run build` created ignored `web-client/dist/`. Neither is included as source evidence or committed.

## recommended main-worktree verification commands
- `cd /Users/Hayato/Documents/GitHub/odn-cwp06-document-two-phase-failure && git rebase <CWP-03-and-CWP-04-integrated-branch>`
- `cd /Users/Hayato/Documents/GitHub/odn-cwp06-document-two-phase-failure/web-client && npm test -- --run src/features/charts/__tests__/documentCreatePanel.test.tsx src/features/charts/__tests__/PatientSummaryPanel.test.tsx src/features/charts/patientFreeDocumentApi.test.ts`
- `cd /Users/Hayato/Documents/GitHub/odn-cwp06-document-two-phase-failure/web-client && npm run typecheck`
- `cd /Users/Hayato/Documents/GitHub/odn-cwp06-document-two-phase-failure/web-client && npm run build`
- `cd /Users/Hayato/Documents/GitHub/odn-cwp06-document-two-phase-failure/web-client && npm run ci`

## raw artifact inclusion
none

## live ORCA mutation
not run

## Phase 3 / Phase 4 / fullflow
not run
