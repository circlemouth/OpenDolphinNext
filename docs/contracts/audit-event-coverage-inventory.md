# Audit Event Coverage Inventory

## Purpose

This inventory connects the required audit event labels in [audit-log.md](./audit-log.md) to implementation evidence, owning workstream, and release status. It is not a replacement for authoritative audit events. It prevents the release gate from treating a prose checklist or UI-only log as audit coverage.

## Coverage status

- `Guarded`: the release guard or focused test fixes the minimum behavior in this Worker F branch.
- `Implemented by owner`: the owning worker has implementation/test evidence recorded in the workstream board or current contracts.
- `Owner verification required`: the owning worker must prove event emission or document a blocker before release.
- `Blocked by live Trial precondition`: live mutation evidence cannot proceed until `no_trial_native_mutation_ready_candidate` is cleared.

## Inventory

| Label | Owning workstream | Coverage status | Current evidence / next proof |
| --- | --- | --- | --- |
| `AUTH_LOGIN` | F / server auth | Owner verification required | Verify authoritative audit event on successful login/session establishment. |
| `AUTH_LOGOUT` | F / server auth | Owner verification required | Verify logout/unsupported logout classification emits sanitized audit. |
| `AUTH_FAILURE` | F / server auth | Owner verification required | Verify failed login, lockout, MFA, and policy rejection audit events. |
| `AUTHZ_DENIED` | F with all resource owners | Owner verification required | Protected-export matrix and denial tests must map denial paths to authoritative audit events. |
| `ADMIN_ROLE_CHANGE` | F / admin security | Owner verification required | Verify role/capability/ORCA link/MFA reset audit plus session revocation. |
| `ADMIN_ACCOUNT_STATE_CHANGE` | F / admin security | Owner verification required | Verify account state and password reset/change audit plus token/session revocation. |
| `PATIENT_READ` | A / F | Owner verification required | Patient context read audit must be proven without raw PHI in details. |
| `CHART_SAVE` | B | Owner verification required | Chart draft/SOAP/module persistence audit must be mapped to chart authority tests. |
| `CHART_FINALIZE` | B | Owner verification required | Finalize and immutable snapshot creation audit must be mapped to finalize tests. |
| `CHART_REVISION` | B | Owner verification required | Amendment/addendum/cancel/void events must emit append-only audit metadata. |
| `PRESCRIPTION_FINALIZE` | C | Owner verification required | Prescription authority finalize audit must be mapped to prescription tests. |
| `PRESCRIPTION_CHANGE` | C | Owner verification required | Change/stop/cancel/reissue/DO import audit must be mapped to prescription tests. |
| `DOCUMENT_ATTACHMENT` | B / F | Owner verification required | Attachment/image/document storage decisions must record sanitized audit or explicit blocker. |
| `PROTECTED_EXPORT` | B / F | Guarded | [protected-export-authorization-matrix.md](./protected-export-authorization-matrix.md) fixes server-side authorization/audit requirement; emission proof remains per route owner. |
| `ORCA_PATIENT_READ` | A | Implemented by owner | Worker A patient cache/read evidence must stay mapped to official patientgetv2 cache tests. |
| `ORCA_PATIENT_MUTATION` | A | Implemented by owner | Worker A patientmodv2 create/update/import evidence must include canonical re-fetch/local sync audit. |
| `ORCA_ACCEPTANCE_READ` | A | Implemented by owner | Worker A acceptance cache/diff/cancel evidence must include sanitized audit mapping. |
| `ORCA_INSURANCE_READ` | A | Implemented by owner | Worker A insurance cache/snapshot evidence must include sanitized audit mapping. |
| `ORCA_DISEASE_MUTATION` | D / C | Owner verification required | Disease mutation and post-send re-fetch audit mapping must be proven by owner tests. |
| `ORCA_MEDICAL_SEND` | D / C | Blocked by live Trial precondition | medicalmodv2 send/re-fetch/reconcile audit cannot be live-proven until exact candidate preflight passes. |
| `ORCA_BILLING_READ` | D | Owner verification required | Billing/income cache read and fail-closed persistence audit must be mapped to D tests. |
| `ORCA_REPORT_CREATE` | D / F | Guarded | Protected report contract requires `ORCA_REPORT_CREATE`; route-level emission proof remains owner verification. |
| `ORCA_SEND_FAILURE` | D / F | Owner verification required | `UNKNOWN`, `AUTH_FAILED`, `CERTIFICATE_FAILED`, warning/unmatched/failure classifications must be audited with fixed codes only. |
| `AUDIT_CHAIN_VERIFY` | F | Guarded | `AuditChainVerifier.verifyAll()` and `check-audit-append-only.sh` guard hash-chain verification availability. |
| `BACKUP_RESTORE_VERIFY` | F | Guarded | [backup-restore-hash-verification.md](../runbooks/backup-restore-hash-verification.md) and `check-backup-restore-runbook.sh` guard restore/hash verification. |

## Release Rule

Before release, every `Owner verification required` row must either move to `Implemented by owner` with focused test evidence, or remain a named release blocker in the worker board/reviewer packet. `Blocked by live Trial precondition` rows must not be converted to success from mock, local, or stale RUN_ID evidence.
