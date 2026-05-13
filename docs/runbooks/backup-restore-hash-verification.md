# Backup / Restore / Hash Verification Runbook

## Purpose

This runbook fixes the operational gate for backing up and restoring OpenDolphinNext authoritative data without promoting stale local ORCA state to source-of-truth status. The operator entrypoint and rehearsal checklist are [backup-restore.md](./backup-restore.md).

It applies to:

- chart authoritative database rows and document integrity metadata
- prescription authoritative rows and event history
- authoritative audit log tables
- attachment and patient image object storage metadata
- ORCA-derived cache, snapshot, operation, transmission, and reconciliation rows

Backup and restore evidence must never contain raw ORCA body, raw XML, ORCA URL, host, credentials, Cookies, Authorization headers, CSRF tokens, patient names, addresses, phone numbers, insurance details, HAR, trace, video, or screenshots.

Production cutover / rollback の最低 stop condition は [production-operations-readiness.md](./production-operations-readiness.md) も併用する。restore read-only 解除、ORCA re-alignment、reviewer packet evidence の可否は同 runbook の production operations gate と矛盾させない。

## Trust Boundary

- OpenDolphinNext chart, prescription, document, attachment metadata, and audit rows are local authoritative data.
- ORCA patient, acceptance, insurance, disease, medical, billing, income, receipt, and report data remain ORCA authoritative data.
- ORCA-derived local rows are cache, snapshot, candidate, response summary, reconciliation result, or audit summary only.
- Client-provided facility, patient, owner, ORCA identifiers, storage key, URI, digest, voucher, sequential, insurance combination, URL, and role claims are not restore authority.

## Backup Preflight

1. Capture a fresh `RUN_ID`.
2. Confirm the target environment, branch, and deployment version.
3. Confirm `/api/health/readiness` returns sanitized checks only.
4. Confirm `auditLog.status=UP`; if audit logging is unavailable, stop non-read-only operations before taking release evidence.
5. Export authoritative database backups using operator-approved DB tooling. Do not add ad hoc dump scripts that print connection strings or credentials.
6. Export object storage inventory using provider tooling that records object count, object version where available, checksum/digest, and server-side encryption state without object contents.
7. Record backup metadata as sanitized summary only:
   - `RUN_ID`
   - backup start/end timestamp
   - component name
   - row count or object count
   - backup artifact digest
   - tool/version
   - operator or automation identity
8. Do not store raw DB dumps, object payloads, raw ORCA responses, logs with credentials, screenshots, HAR, trace, or video in tracked repo evidence.

## Restore Execution

1. Put the application into read-only mode before restore or migration recovery.
2. Keep ORCA send, resend, add, replace, and reconciliation persistence routes fail-closed during restore.
3. Restore authoritative DB and object metadata from the approved backup set.
4. Restore object storage content only from the matching backup generation. Do not synthesize object keys from client data.
5. Do not mark local `ORCA_SENT`, `ORCA_CONFIRMED`, `ORCA_UNKNOWN`, `ORCA_FAILED`, or `CORRECTION_REQUIRED` as current ORCA truth after restore.
6. Keep local ORCA cache and snapshot rows as comparison material until server-side ORCA re-fetch and reconciliation finish.

## Required Hash Verification Gate

Read-write service may resume only after all of the following pass:

1. `AuditChainVerifier.verifyAll()` verifies `opendolphin.audit_event` payload hashes, event hashes, previous pointers, and chain head consistency.
2. Chart and prescription content hash verification confirms restored authoritative payloads match their stored hash metadata.
3. Document integrity verification confirms active and historical keyring entries can verify stored documents under `document.integrity.mode=enforce`.
4. Object storage inventory digest comparison confirms every referenced attachment/image object exists with the expected digest or provider checksum.
5. Export/readability hash verification confirms chart export JSON/PDF/CSV projections can be regenerated from restored OpenDolphinNext chart authority rows, prescription event rows, and ORCA operation ledger summaries without raw ORCA body, ORCA credentials, certificate material, storage URI, object key, or raw report binary references. The contract is [../contracts/export-readability.md](../contracts/export-readability.md).
6. Accounting cache boundary verification confirms restored `orca_billing_cache` and `orca_report_snapshot` rows remain ORCA-derived cache/snapshot/log rows with `sourceSystem`, `sourceApi`, `fetchedAt`, visit boundary metadata where available, request/response hash, and sanitized summary only. The contract is [../contracts/accounting-cache-boundary.md](../contracts/accounting-cache-boundary.md).
7. Verification output is summarized with counts, fixed status, and digest values only. It must not include patient names, addresses, phone numbers, insurance identifiers, raw document contents, object keys beyond sanitized references, raw ORCA body, raw XML, or credentials.

If any check fails, keep the environment in read-only mode, create an incident record with sanitized failure classification, and do not run ORCA re-alignment or resend operations.

## ORCA Re-Alignment After Restore

After hash verification passes:

1. Re-fetch ORCA patient, acceptance, insurance, disease, medical, billing, income, receipt, and report state through server-side ORCA adapters only.
2. Compare restored local snapshots and transmissions against the freshly re-fetched ORCA state.
3. Put every mismatch into `NEEDS_REVIEW` or the existing ORCA transmission review queue.
4. Do not use local restored `ORCA_SENT` or `ORCA_CONFIRMED` status as proof of ORCA completion.
5. Do not auto-resend after restore. Re-send, add-send, or replace-send requires explicit operator approval after read-only ORCA reconciliation.
6. If ORCA `Medical_Mode` or `Medical_Mode2` indicates non-open state, set `resendBlocked=true` and require administrator review.
7. Audit every restore decision, hash verification result, ORCA re-fetch, mismatch classification, resend block, and read-only release decision as sanitized summary.

## Evidence Policy

Allowed tracked evidence:

- sanitized command summary
- row counts and object counts
- backup artifact digest
- hash verification status and count summary
- ORCA re-alignment status class
- fixed reason codes
- `RUN_ID`, commit hash, tool version, and operator/automation identity

Forbidden tracked evidence:

- raw DB dumps
- object payloads
- raw ORCA body or XML
- request/response body files
- credential-bearing URLs
- ORCA username/password, Basic header, certificate material, Cookie, Authorization header, JSESSIONID, CSRF token
- patient name, address, phone number, raw insurance identifier or symbol/number
- HAR, trace, video, screenshot, `error-context.md`, raw network JSON

## Verification Commands

Run these before release or restore sign-off:

```bash
bash server-modernized/tools/ci/check-backup-restore-runbook.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-audit-append-only.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-doc-links.sh
```

Focused server regression for guard coverage:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=RepoGuardScriptsTest test
```
