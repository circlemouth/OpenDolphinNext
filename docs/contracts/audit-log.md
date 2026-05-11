# Audit Log Contract

## Purpose

OpenDolphinNext の監査ログは、診療録・処方・ORCA 連携・管理操作の真正性を支える append-only 証跡である。通常の業務 API、管理 API、運用 UI は監査イベントを更新・削除・再採番してはならない。

## Authoritative Tables

- `opendolphin.audit_event`
- `opendolphin.audit_chain_head`
- `opendolphin.audit_export_outbox`

`audit_event` は `AuthoritativeAuditRepository.append(...)` だけで追加する。`audit_chain_head` は同じ transaction 内で直前イベントの hash を指す head として更新する。`audit_export_outbox` は外部配送のための outbox であり、監査イベント本体の所有者ではない。

## Append-Only Rules

- production code must not `UPDATE`, `DELETE FROM`, or `TRUNCATE` `opendolphin.audit_event`.
- public repository APIs must not expose `update`, `delete`, `remove`, or `truncate` operations for authoritative audit events.
- tamper investigation must use read-only verification. It must not repair the chain in place.
- audit payloads must be sanitized before hashing and persistence.
- raw credentials, Cookies, Authorization headers, JSESSIONID, CSRF tokens, raw ORCA bodies, patient names, addresses, phone numbers, and insurance details must not be persisted in audit payloads.

## Hash Chain

Each event stores:

- `payload_hash`
- `previous_event_id`
- `previous_hash`
- `event_hash`

`AuditHashService` canonicalizes the sanitized payload and computes the event hash from stable event fields plus the previous chain pointer. `AuditChainVerifier.verifyAll()` recomputes payload hashes, event hashes, previous pointers, and chain head consistency.

## Write Path Availability

`AuthoritativeAuditRepository.isWritePathAvailable()` locks `audit_chain_head` and fails closed when the authoritative audit write path is unavailable. Readiness exposes this only as `auditLog.status=DOWN` with `reasonCode=audit_log_write_unavailable`; it must not expose DB internals, exception text, host, URL, or credentials.

## Required Event Coverage

The following labels are the minimum audit event coverage matrix for release gates. Implementations may use more specific event names, but they must map back to these labels in tests, contracts, or release evidence. Missing coverage is a release blocker; UI hiding, local-only logs, or reviewer notes are not substitutes for authoritative audit events.

Current implementation evidence and owning workstream status are tracked in [audit-event-coverage-inventory.md](./audit-event-coverage-inventory.md). The inventory is part of the release gate: a label may remain blocked, but it must not disappear or become ownerless.

| Label | Minimum coverage |
| --- | --- |
| `AUTH_LOGIN` | Successful login and session establishment. |
| `AUTH_LOGOUT` | Logout and session cleanup, including unsupported server logout classification. |
| `AUTH_FAILURE` | Failed login, lockout, MFA failure, and authentication policy rejection. |
| `AUTHZ_DENIED` | Permission denial for user, patient, export, admin, ORCA, and audit-log surfaces. |
| `ADMIN_ROLE_CHANGE` | Role, privileged capability, ORCA link, MFA reset, or equivalent authority change. |
| `ADMIN_ACCOUNT_STATE_CHANGE` | Account suspension, reactivation, password reset/change, and session/token revocation. |
| `PATIENT_READ` | Patient chart/context read where patient context is established. |
| `CHART_SAVE` | Draft chart/SOAP/body/module persistence. |
| `CHART_FINALIZE` | Chart finalization and immutable snapshot creation. |
| `CHART_REVISION` | Amendment, addendum, cancellation, or void event. |
| `PRESCRIPTION_FINALIZE` | Prescription authority finalize event. |
| `PRESCRIPTION_CHANGE` | Prescription change, stop, cancel, reissue, or DO/import event. |
| `DOCUMENT_ATTACHMENT` | Attachment, patient image, document upload/download/delete, and storage guard decision. |
| `PROTECTED_EXPORT` | PDF, print, period export, chart export, and protected report export/download. |
| `ORCA_PATIENT_READ` | Official patient read/cache update and patient-not-found classification. |
| `ORCA_PATIENT_MUTATION` | Official patient create/update/import send plus canonical re-fetch/local sync result. |
| `ORCA_ACCEPTANCE_READ` | Acceptance list read/cache/diff/cancel detection. |
| `ORCA_INSURANCE_READ` | Insurance combination read/cache/snapshot and mismatch detection. |
| `ORCA_DISEASE_MUTATION` | Disease create/update/delete/outcome/organize send and post-send re-fetch result. |
| `ORCA_MEDICAL_SEND` | medicalmodv2 preparation/send/re-fetch/reconcile and idempotency result. |
| `ORCA_BILLING_READ` | Billing/income cache read and fail-closed persistence result. |
| `ORCA_REPORT_CREATE` | ORCA report snapshot/binary storage gate and protected report result. |
| `ORCA_SEND_FAILURE` | `ORCA_REJECTED`, `ORCA_WARNING`, `ORCA_UNMATCHED`, `NETWORK_FAILED`, `CERTIFICATE_FAILED`, `AUTH_FAILED`, `UNKNOWN`, and `NEEDS_REVIEW` classifications. |
| `AUDIT_CHAIN_VERIFY` | Hash-chain verification batch result and tamper/read-only investigation outcome. |
| `BACKUP_RESTORE_VERIFY` | Backup, restore, object inventory digest, chart/prescription content hash, and ORCA re-alignment gate result. |

Each event must use sanitized details only: actor, role, target type, target hash or server identifier, facility, outcome, fixed reason/status code, request/trace ID, and hash/classification fields. Do not store raw ORCA bodies, credentials, cookies, session tokens, CSRF values, patient names, addresses, phone numbers, insurance details, raw invoice numbers, raw `Data_Id`, raw `Medical_Uid`, HAR, trace, video, screenshots, or raw network dumps.
## Chart Revision Events

`POST /api/charts/{chartId}/revisions/{revisionId}/amend|addendum|cancel` appends `CHART_REVISION_EVENT_RECORDED` after the chart revision event row is persisted. The audit payload is limited to facility, chart/revision/event identifiers, revision numbers/statuses, event type, resulting status, content hash, reason-code presence, subject type/id, and outcome. It must not persist reason text, raw ORCA bodies, credentials, Cookies, Authorization headers, CSRF tokens, patient names, addresses, phone numbers, or insurance details. If the authoritative audit service cannot append, the chart revision operation fails closed instead of returning a successful mutation without audit evidence.

## Backup / Restore Verification

Backup restore and migration recovery must follow [backup-restore-hash-verification.md](../runbooks/backup-restore-hash-verification.md). Restore investigation is read-only until `AuditChainVerifier.verifyAll()` and chart/prescription content hash verification pass. The verifier must not repair the chain in place, and restored local ORCA transmission states must not be promoted to ORCA truth before server-side ORCA re-alignment.

## CI Guard

`server-modernized/tools/ci/check-audit-append-only.sh` enforces the minimum contract:

- `AuthoritativeAuditRepository.append(...)` exists.
- public update/delete/remove/truncate methods are not exposed by the authoritative repository.
- `AuditChainVerifier.verifyAll()` exists.
- production source roots do not mutate `opendolphin.audit_event` with `UPDATE`, `DELETE FROM`, or `TRUNCATE TABLE`.
- the required audit event coverage matrix remains present in this contract.
- the audit event coverage inventory remains present and lists every required label with a coverage status.

The guard intentionally scans production source only. Tests may deliberately tamper with `audit_event` to prove verifier failure detection.

`server-modernized/tools/ci/check-sensitive-evidence-redaction.sh` enforces the tracked evidence boundary for browser bundles, Playwright/test output, and test snapshots:

- review-target output paths must not contain HAR, trace, video, screenshot, `error-context.md`, raw network JSON, request XML, or raw XML/body files.
- output and snapshot text must not contain credential-bearing `Authorization` / `Cookie` / `JSESSIONID` / CSRF markers, raw Basic values, ORCA credential env assignments, raw ORCA body/XML keys, patient name/address fields, or insurance number fields.
- historical `artifacts/` are not release evidence by default; reviewer packets must copy only sanitized extracted subsets under the reviewer-submission packet runbook.

## Verification

Focused checks:

```bash
bash server-modernized/tools/ci/check-audit-append-only.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-backup-restore-runbook.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=AuditChainVerifierTest,AuthoritativeAuditRepositoryTest,RepoGuardScriptsTest test
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=ChartRevisionFinalizeServiceTest,AuditTrailServiceTest test
```
