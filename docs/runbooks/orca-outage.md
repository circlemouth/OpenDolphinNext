# ORCA / DB Outage Runbook

## Purpose

This runbook defines business continuity rules for ORCA / WebORCA outage, DB outage, certificate/authentication/communication failures, and operator response. Detailed recovery rules remain [orca-outage-recovery.md](./orca-outage-recovery.md) and UNKNOWN-specific steps remain [orca-unknown-resolution.md](./orca-unknown-resolution.md).

## Detection

- ORCA outage is identified from sanitized readiness, fixed reason codes, or ORCA ledger failure classifications. Do not expose ORCA URL, host, port, credentials, certificate path, stack trace, or raw upstream body.
- DB outage is identified when DB write path, audit log write path, migration recovery, or restore is unavailable or in progress.
- UNKNOWN is identified when ORCA response success/failure cannot be proven. UNKNOWN is not success.

## Allowed During ORCA Outage

- View existing charts, prescriptions, snapshots, ORCA cache, and audit summaries.
- Save chart drafts and prescription drafts only when DB write path and audit write path are healthy and operational policy allows offline clinical documentation.
- Finalize chart content only if the chart-finalize snapshot contract is satisfied and the UI/server clearly state ORCA send/accounting is pending or blocked.
- Prepare ORCA send candidates as local candidates when they are clearly marked unsent and not ORCA truth.

## Blocked During ORCA Outage

- ORCA patient create/update.
- ORCA disease mutation.
- ORCA medical/billing send, resend, add-send, replace-send, cancellation, or automatic reconciliation persistence.
- UI elevation to registered, reflected, billed, accounting completed, ORCA accepted, or claim-ready based on local state alone.
- Local patient, disease, insurance, billing, or report cache fallback as ORCA source of truth.

## DB Outage / Read-Only Mode

When DB write path or audit write path is unavailable, the application is read-only even if ORCA is reachable.

Blocked in DB read-only mode:

- Chart draft save, finalize, amendment, addendum, cancellation, voiding.
- Prescription create, finalize, change, stop, cancel, reissue, resend.
- Attachment add/delete/relink.
- ORCA send, resend, reconciliation persistence, and operator resolution that would mutate local state.

Allowed in DB read-only mode:

- Read existing records and sanitized readiness.
- Export only if the export path does not require new audit/write state; otherwise fail closed.

## Failure-Specific First Response

| Failure | First response | Recovery boundary |
| --- | --- | --- |
| Communication断 / timeout | Classify as `NETWORK_FAILED` or `UNKNOWN`; stop auto resend. | Re-fetch with read-only ORCA API and reconcile before any resend. |
| Authentication failure | Classify as `AUTH_FAILED`; verify secret store injection and credential rotation status. | Do not log raw credential or Basic header; resume only after sanitized readiness is `UP`. |
| Certificate expiry / TLS failure | Classify as `CERT_FAILED`; verify certificate generation, expiry, chain, and secret store reference. | Do not bypass TLS in production; update secret store and restart through approved deployment path. |
| ORCA other terminal in use / busy | Classify as `UNKNOWN` or business conflict depending on endpoint semantics. | Do not mark accepted; wait or read-only re-fetch and require operator review. |
| ORCA business warning / unmatch | Classify as `WARNING_NEEDS_REVIEW` or `UNMATCHED`. | Show review queue; do not collapse to success. |

## Audit And Evidence

- Record incident `RUN_ID`, fixed failure classification, affected operation ids, transmission ids, counts, and operator decision.
- Audit log viewing is limited to authorized operations/admin roles. General clinical users do not receive raw ledger details or system configuration.
- Audit retention follows the production legal/clinic policy; protected audit exports must be retained outside the application storage boundary with append-only or WORM-capable controls where available.
- External preservation contains hashes, counts, event ids, and fixed reason codes only. It must not contain raw ORCA body, patient detail, insurance detail, credential, HAR, trace, video, screenshot, or raw network JSON.

## Verification

```bash
bash server-modernized/tools/ci/check-backup-restore-runbook.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
```

