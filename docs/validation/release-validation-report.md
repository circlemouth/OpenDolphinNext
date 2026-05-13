# Release Validation Report

このテンプレートは release validation の判定記録です。実行証跡は `artifacts/orca-remediation/closeout/<RUN_ID>/` に置き、この文書には raw ORCA body、credential、患者氏名、住所、電話番号、保険記号番号、内部 URL、HAR、trace、video、screenshot、raw network JSON を貼り付けません。

## Run Metadata

| Field | Value |
| --- | --- |
| RUN_ID | `<YYYYMMDDThhmmssZ>` |
| Branch | `<branch>` |
| Base | `master` |
| Merge target | `master` |
| Accepted commit | `<sha>` |
| Validator | `<name>` |
| Validation date | `<YYYY-MM-DD>` |

## Overall Decision

| Decision | Status | Reason |
| --- | --- | --- |
| GO / NO-GO / PENDING | `PENDING` | `<short reason>` |

`GO` は全必須 gate が成功し、未実行項目に production release blocker がない場合だけ使用します。`NO-GO` は security / medical safety / secret / PHI / source-of-truth / UNKNOWN / audit / idempotency のいずれかが失敗した場合に使用します。`PENDING` は H/J 統合後の live validation、repo-external secret/config sign-off、または operator approval が未完了の場合に使用します。

## Final Gate Checklist

| Gate | Command / Evidence | Status | Evidence path or hash | Not run reason | Residual risk |
| --- | --- | --- | --- | --- | --- |
| Doc links | `bash server-modernized/tools/ci/check-doc-links.sh` | `PENDING` |  |  |  |
| Config contract | `bash server-modernized/tools/ci/check-config-contract.sh` | `PENDING` |  |  |  |
| Runtime lookup boundary | `bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"` | `PENDING` |  |  |  |
| Route inventory | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test` | `PENDING` |  |  |  |
| Round 3/4 guard entrypoints | `bash scripts/ci/verify-release-validation-entrypoints.sh --dry-run` and `bash scripts/ci/verify-ehr-orca-round3-guards.sh` | `PENDING` |  |  |  |
| Web guard | `cd web-client && npm run verify:web-guard` | `PENDING` |  |  |  |
| Web typecheck | `cd web-client && npm run typecheck` | `PENDING` |  |  |  |
| Web CI | `cd web-client && npm run ci` | `PENDING` |  |  |  |
| Production bundle secret scan | `cd web-client && npm run build` then `npm run verify:prod-bundle-secrets` | `PENDING` |  |  |  |
| Sensitive evidence redaction | `bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"` | `PENDING` |  |  |  |
| DADS / medical safety UI | `cd web-client && npm run verify:medical-safety-ui-copy` plus targeted UI tests | `PENDING` |  |  |  |
| ORCA ledger / UNKNOWN / retry | focused Maven tests for ledger, resilience, idempotency, billing correction | `PENDING` |  |  |  |
| Snapshot / chart authority | focused Maven tests for chart snapshot and finalized write guards | `PENDING` |  |  |  |
| Disease boundary | focused Maven tests and disease authority guard | `PENDING` |  |  |  |
| Prescription authority / hash chain | focused Maven tests and schema guard | `PENDING` |  |  |  |
| Export security / readability | H merge evidence and protected export/readability tests | `PENDING` |  | `Run after H merge` |  |
| Backup / restore / hash verification | `bash server-modernized/tools/ci/check-backup-restore-runbook.sh --root "$(git rev-parse --show-toplevel)"` | `PENDING` |  |  |  |
| Live ORCA validation checklist | `ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>` and J runbook evidence | `PENDING` |  | `Run after J merge and operator approval` |  |
| Reviewer packet validation | `./scripts/create-reviewer-submission-packet.sh ...` and `./scripts/validate-reviewer-submission-packet.sh ...` | `PENDING` |  |  |  |

## Medical Safety And Security Confirmation

| Check | Status | Evidence / note |
| --- | --- | --- |
| ORCA source-of-truth data was not made local authority | `PENDING` |  |
| Finalized chart records and finalized prescription orders are not directly overwritten | `PENDING` |  |
| ORCA failure, warning, mismatch, and UNKNOWN are not treated as success | `PENDING` |  |
| Idempotency key and duplicate-send prevention are covered | `PENDING` |  |
| Audit and ORCA ledger are append-only or tamper-evident | `PENDING` |  |
| Patient mix-up prevention UI and critical-operation patient identifiers are covered | `PENDING` |  |
| Browser bundle and reports do not expose ORCA URL, Basic auth, certificates, or passwords | `PENDING` |  |
| Export / PDF / CSV / JSON / validation evidence excludes secrets and real patient information | `PENDING` |  |
| Health/readiness responses remain sanitized | `PENDING` |  |

## Misuse Cases

| Misuse case | Gate that detects it | Status |
| --- | --- | --- |
| Release validation omits export secret leakage checks | Production bundle secret scan, sensitive evidence redaction, export security entry | `PENDING` |
| Live ORCA evidence includes unsanitized body, credential, PHI, HAR, trace, or screenshot | live checklist dry-run, sensitive evidence redaction, reviewer packet validation | `PENDING` |
| Route / DADS / UNKNOWN / hash-chain focused tests exist but are not executed by final gate | route inventory, web guard, focused Maven tests, release entrypoint dry-run | `PENDING` |
| Backup restore triggers automatic ORCA resend or treats restored ledger state as success | backup/restore guard, ORCA ledger / UNKNOWN focused tests | `PENDING` |

## H / J Merge Follow-Up

| Item | Required after merge | Status |
| --- | --- | --- |
| H export security / readability | Add concrete H test class or npm test path, then run export secret/readability gate | `PENDING` |
| J backup / restore | Confirm `backup-restore-hash-verification.md`, outage recovery, audit contract, release validation remain linked by guard | `PENDING` |
| J live ORCA validation | Run dry-run checklist first, then live steps only with operator approval and sanitized evidence mode | `PENDING` |

## Residual Risks

- `<risk, owner, next action>`

## Final Notes

- Do not attach raw logs. Record sanitized summary path, command exit status, and hashes only.
- Any `NO-GO` item must include root cause, corrective action, rerun command, and result before this report can move to `GO`.
