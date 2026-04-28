# RWO-08B medicalgetv2 identifier contract decision

RUN_ID: `20260428T224646Z`

## Result

`RWO-08B_MEDICALGETV2_API15_IDENTIFIER_CONTRACT_DECISION_NO_LIVE` is resolved as a minimized Trial business-state/test-data prerequisite.

The accepted non-duplicate target remains patient `00002`, acceptance date `2026-04-29`, class `01`, selected acceptance row hash `b3b3d7c1416f047abb6450023e575fa39f53ed1d8f804aef8cf3551d945a5ddb`.

Do not run diagnostic Fullflow from the current evidence.

## Threat model checks

- Do not treat the target-ready `acceptlstv2` row as medicalgetv2 or order-send readiness.
- Do not reuse duplicate-blocked `00001` or `00005` unchanged.
- Do not treat HTTP 200, read-only discovery, dry-run, or identifier-preflight metadata as Fullflow L4 success.
- Do not capture or commit raw ORCA bodies, credentials, patient details, insurance details, HAR, trace, video, screenshot, or raw network dumps.

## Official-source decision

Checked official ORCA pages on `2026-04-29`:

- `https://www.orca.med.or.jp/receipt/users/tec/api/medicalinfo.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/acceptancelst.html`

Medicalgetv2 class `01` is the official visit-history lookup. The official response contract includes visit-history identifiers such as `Department_Code`, `Sequential_Number`, and `Insurance_Combination_Number`. The same official page documents Api_Result `15` as no target/object found.

Acceptlstv2 can provide server-derived acceptance, department, patient, and insurance-combination presence, but it is not documented as a source for medicalgetv2 `Sequential_Number`.

## Sanitized evidence decision

Prior read-only wrapper evidence for class `01` reached medicalgetv2 at transport level, but returned:

- `apiResult`: `15`
- `apiResultClass`: `nonzero`
- `medicalReadyRowCount`: `0`
- `identifierPreflightReady`: `false`

The only sanitized class `01` row had `hasPerformDate=true`, but lacked `hasDepartmentCode`, `hasSequentialNumber`, `hasInsuranceCombinationNumber`, and `hasInvoiceNumber`.

Class `03` probing also returned `apiResult=15` and no ready identifier rows.

## Contract outcome

Combining server-derived `acceptlstv2` metadata with an Api_Result `15` medicalgetv2 row is not a safe identifier-preflight contract. It would overclaim Fullflow readiness because the official visit-history identifier row is absent.

No alternative official read-only endpoint was proven in this run to supply the missing `Sequential_Number` safely without raw artifacts.

The minimized question is:

> For Trial patient `00002` on `2026-04-29` class `01`, should the operator create or select a target that has an actual medicalgetv2 class `01` visit-history row with `Department_Code`, `Sequential_Number`, and `Insurance_Combination_Number` before diagnostic Fullflow retry?

## Non-claims

This is not diagnostic Fullflow success, Trial order-send business acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness.

Credentials captured: `false`

Diagnostic artifacts captured: `false`

Raw artifacts committed or packaged: `false`

Production ORCA attempted: `false`

S3/object storage used: `false`
