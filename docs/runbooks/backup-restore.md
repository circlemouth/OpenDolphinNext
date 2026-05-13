# Backup / Restore Runbook

## Purpose

This runbook defines the operator-facing backup, restore, rehearsal, and post-restore verification flow. The detailed hash verification contract remains [backup-restore-hash-verification.md](./backup-restore-hash-verification.md); this file is the production operations entrypoint.

Do not store raw DB dumps, object payloads, raw ORCA body/XML, ORCA URL, Basic credentials, certificate material, Cookie, Authorization, JSESSIONID, CSRF, patient name, address, phone number, insurance detail, HAR, trace, video, screenshot, or raw network JSON in tracked evidence.

## Source-Of-Truth Boundary

- OpenDolphinNext source of truth: chart revisions, finalized chart content, prescription orders/revisions/items/events, document integrity metadata, attachment/patient image metadata, audit events, and operator decisions.
- ORCA / WebORCA source of truth: patient demographics, acceptance, insurance, disease, medical acts, billing, income, receipts, reports, and claim-related state.
- Local ORCA data after backup/restore is cache, snapshot, candidate, ledger, transmission, response summary, reconciliation result, or audit summary. It is comparison material, not ORCA truth.
- Client-provided `facilityId`, `ownerId`, `role`, patient identifiers, voucher, sequential number, insurance combination, `Medical_Uid`, `uri`, `digest`, `objectKey`, URL, or raw XML is never restore authority.

## Mandatory Backup Scope

Back up these DB and object metadata domains as a single generation:

- Chart authority: chart revision rows, finalized content hash metadata, chart snapshots, chart event history, document links.
- Prescription authority: prescription order, revision, item, and prescription event rows, including `previous_event_hash`, `event_hash`, and payload/content hashes.
- Chart snapshot and prescription event snapshots that explain the clinical state at signing or ordering time.
- Audit event tables and append-only hash chain metadata.
- ORCA ledger: `orca_operation`, `orca_transmission`, `orca_response_summary`, `orca_reconciliation_result`, ORCA billing cache, ORCA report snapshot, and sanitized ORCA cache tables.
- Attachment, patient image, document integrity, and protected report binary metadata. Object contents are backed up by provider-approved storage tooling with counts and checksums.

ORCA-derived cache can be rebuilt from ORCA and has lower restore priority than OpenDolphinNext authoritative chart, prescription, audit, and document integrity records. Immutable chart snapshots and ORCA ledger rows still must be restored because they explain past clinical decisions and transmission outcomes.

## Backup Preflight

1. Capture `RUN_ID` with `date -u +%Y%m%dT%H%M%SZ`.
2. Confirm the accepted branch, commit, deployment version, and target environment.
3. Confirm `/api/health/readiness` is sanitized and `auditLog.status=UP`.
4. Confirm ORCA and DB credentials are available only from deployment secret store or approved local secret files. Record only set/unset and reason codes.
5. Put the system into a controlled backup window or use an operator-approved consistent snapshot mechanism.
6. Record sanitized backup metadata: component name, start/end timestamp, row/object count, backup generation id, artifact digest, tool/version, operator or automation identity.

## Restore Procedure

1. Enter read-only mode before restoring DB or object storage metadata.
2. Keep ORCA send, resend, add, replace, billing send, and reconciliation persistence routes fail-closed.
3. Restore OpenDolphinNext authoritative DB records first: chart authority, prescription authority, audit events, document integrity, and object metadata.
4. Restore ORCA-derived cache/snapshot/ledger rows as comparison and explanation data. Do not promote restored `ORCA_SENT`, `ORCA_CONFIRMED`, `ORCA_UNKNOWN`, `ORCA_FAILED`, or `CORRECTION_REQUIRED` to current ORCA truth.
5. Restore object contents only from the matching backup generation. Never synthesize object keys or digests from client input or operator notes.
6. Keep read-only mode until the verification gate passes.

## Post-Restore Verification Gate

Read-write service may resume only after all checks pass:

1. Run `AuditChainVerifier.verifyAll()` for audit payload hashes, event hashes, previous pointers, and chain heads.
2. Verify chart and prescription content hashes, including finalized chart content and prescription event hash chain.
3. Verify document integrity keyring and stored document signatures.
4. Compare object storage inventory count/checksum/digest for attachments, patient images, protected reports, and document payloads.
5. Re-fetch ORCA patient, acceptance, insurance, disease, medical, billing, income, and report state through server-side ORCA adapters.
6. Compare restored snapshots and ledger summaries against fresh ORCA re-fetch summaries. Mismatch, stale cache, and unknown states become `NEEDS_REVIEW`; they do not become success.
7. Confirm no automatic ORCA resend, cancellation, add-send, or replace-send ran during restore.

## ORCA Re-Alignment Priority

1. Preserve OpenDolphinNext chart/prescription/audit authority first.
2. Preserve immutable chart snapshots and prescription event history second.
3. Preserve ORCA ledger and response/reconciliation summaries third because they explain previous transport outcomes.
4. Rebuild ORCA-derived display cache last from ORCA current state.

If restored local ORCA cache conflicts with fresh ORCA state, ORCA remains source of truth and the local row becomes `NEEDS_REVIEW` or stale comparison evidence.

## Backup / Restore Rehearsal Checklist

- `RUN_ID` recorded and evidence root prepared under `artifacts/` only.
- Restore rehearsal uses sanitized summaries, counts, hashes, and reason codes only.
- Chart finalized content hash and prescription event hash chain verification pass.
- Audit chain verification passes before read-only release.
- Object storage inventory digest/count comparison passes.
- ORCA re-fetch plan covers patient, acceptance, insurance, disease, medical, billing, income, and report state.
- UNKNOWN / failed / correction-required transmissions remain reviewable and are not auto-resent.
- Evidence redaction guard passes before reviewer packet or production sign-off.
- Operator signs off that no raw credential, raw ORCA body, raw patient detail, HAR, trace, video, screenshot, or raw network JSON was retained in tracked evidence.

## Verification Commands

```bash
bash server-modernized/tools/ci/check-backup-restore-runbook.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-doc-links.sh
```

