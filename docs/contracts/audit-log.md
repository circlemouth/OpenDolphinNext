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
