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

## CI Guard

`server-modernized/tools/ci/check-audit-append-only.sh` enforces the minimum contract:

- `AuthoritativeAuditRepository.append(...)` exists.
- public update/delete/remove/truncate methods are not exposed by the authoritative repository.
- `AuditChainVerifier.verifyAll()` exists.
- production source roots do not mutate `opendolphin.audit_event` with `UPDATE`, `DELETE FROM`, or `TRUNCATE TABLE`.

The guard intentionally scans production source only. Tests may deliberately tamper with `audit_event` to prove verifier failure detection.

## Verification

Focused checks:

```bash
bash server-modernized/tools/ci/check-audit-append-only.sh --root "$(git rev-parse --show-toplevel)"
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=AuditChainVerifierTest,AuthoritativeAuditRepositoryTest,RepoGuardScriptsTest test
```
