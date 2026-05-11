# Production Operations Readiness Runbook

## Purpose

This runbook fixes the minimum production operations gate before an OpenDolphinNext ORCA remediation pair release. It does not replace [release-validation.md](./release-validation.md), [orca-remediation-cutover.md](../releases/orca-remediation-cutover.md), [orca-outage-recovery.md](./orca-outage-recovery.md), or [backup-restore-hash-verification.md](./backup-restore-hash-verification.md). It makes the operator sign-off checklist explicit so production readiness is not inferred from a successful Trial read or local CI run alone.

## Scope

The gate applies to:

- web-client and server-modernized pair release planning
- ORCA/WebORCA connection and credential provisioning
- DB, audit log, attachment/patient image object storage, and document integrity readiness
- backup, restore, rollback, and read-only recovery procedures
- release evidence and reviewer packet sanitization

## Trust Boundary

- Production secrets and ORCA credentials are supplied by the deployment secret store only.
- Runtime config and operator sign-off may be summarized in tracked evidence only as set/unset, fixed status, counts, hashes, and reason codes.
- ORCA Trial, preprod, or production connection results are not accepted evidence unless they are attached to the current RUN_ID with sanitized summaries.
- Local ORCA cache, snapshot, transmission, billing, and report rows are comparison data after restore. They are not ORCA truth.

## Mandatory Pre-Cutover Checks

1. Confirm the accepted branch/commit and the reviewer submission packet accepted HEAD match.
2. Confirm `web-client` and `server-modernized` are deployed as a pair. Do not deploy one side with an older route taxonomy or ORCA contract.
3. Run [release-validation.md](./release-validation.md) required commands, including `web-client npm run ci`, Maven static-analysis verify, and runtime-ready smoke or a documented current blocker.
4. Confirm the ORCA connection target is explicitly selected for the environment. Do not rely on implicit Trial, fallback facility, or last-edited connection records.
5. Confirm ORCA credentials, ORCA credential protector key, 2FA key, DB password, document integrity keyring, and S3/object storage secrets are present in the deployment secret store and absent from tracked repo evidence.
6. Confirm `/api/health/readiness` returns only sanitized checks and does not expose URL, host, port, scheme, username, statusCode, raw exception, stack trace, or secret path.
7. Confirm `auditLog.status=UP`; if audit logging is unavailable, keep the system read-only and stop ORCA send/resend/reconcile operations.
8. Confirm attachment/patient image storage mode is appropriate for the environment. Production-like deployments must not use the object-storage-free Trial profile.
9. Confirm backup preflight and restore drill evidence exists as sanitized summary, row/object counts, and digests only.
10. Confirm rollback target and pair rollback procedure are recorded before cutover begins.

## Required Stop Conditions

Stop cutover or keep read-only mode if any of the following occur:

- `npm run ci`, Maven static-analysis verify, runtime-ready smoke, live Trial exact preflight, or reviewer packet validation fails without a current blocker classification.
- ORCA readiness is `DOWN`, facility configuration is unresolved, or the connection target is not explicitly approved for the environment.
- audit log write path is unavailable.
- DB restore, migration recovery, or document integrity verification is in progress or has not passed.
- object storage is required but disabled, unreachable, missing digest verification, or missing retention metadata for protected reports.
- live Trial candidate discovery has `acceptedCandidateCount=0` and no exact selected-candidate preflight with `acceptedForPhase3Attempt=true`.
- any evidence includes raw ORCA body/XML, credential-bearing URL, Basic/Authorization/Cookie/JSESSIONID/CSRF, patient name/address/phone, insurance detail, HAR, trace, video, screenshot, raw network JSON, request XML, or raw report body.

## Backup / Restore / Read-Only Release

Before releasing read-write service after restore:

1. Run `AuditChainVerifier.verifyAll()`.
2. Verify chart and prescription content hashes.
3. Verify document integrity keyring and stored document signatures.
4. Compare object storage inventory digest/counts for attachments, patient images, and protected report binaries.
5. Re-fetch ORCA patient, acceptance, insurance, disease, medical, billing, income, and report state through server-side adapters.
6. Put mismatches into `NEEDS_REVIEW`; do not auto-resend.
7. Keep `ORCA_SENT`, `ORCA_CONFIRMED`, `ORCA_UNKNOWN`, `ORCA_FAILED`, and `CORRECTION_REQUIRED` local states from being promoted to ORCA truth until server-side re-alignment passes.

## Evidence Policy

Allowed tracked evidence:

- RUN_ID, accepted branch, accepted commit hash
- command name and pass/fail status
- fixed blocker classification and reason code
- row/object counts, request/response hash, payload/content hash, artifact digest
- sanitized readiness status and component names from the current contract
- operator approval reference hash

Forbidden tracked evidence:

- raw ORCA body, raw XML, raw report body, request XML, response XML
- credential-bearing URL, ORCA username/password, Basic/Authorization/Cookie/JSESSIONID/CSRF
- certificate material, private key, secret path with sensitive value
- patient name, address, phone number, raw insurance symbol/number/detail
- raw invoice number, raw Data_Id, raw Medical_Uid, raw voucher/sequential/insurance combination
- HAR, trace, video, screenshot, error-context.md, raw network JSON

## Verification Commands

Run these before production operations sign-off:

```bash
bash server-modernized/tools/ci/check-production-operations-runbook.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-backup-restore-runbook.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-live-orca-trial-harness.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
```

Focused guard regression:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=RepoGuardScriptsTest test
```
