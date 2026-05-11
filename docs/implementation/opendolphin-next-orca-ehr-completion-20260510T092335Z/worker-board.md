# OpenDolphinNext ORCA EHR Worker Board

- Status: active parallel heartbeat board
- RUN_ID: `20260510T195822Z`
- Created: 2026-05-10
- Parallel plan: [parallel-heartbeat-plan.md](./parallel-heartbeat-plan.md)
- Primary checklist: [opendolphin-next-orca-ehr-implementation-checklist.md](./opendolphin-next-orca-ehr-implementation-checklist.md)

## Board Rules

- This file tracks assignments, queues, heartbeat outcomes, blockers, and integration state.
- The checklist remains the requirements source of truth. Do not add owner labels to checklist items.
- Each worker updates only its own row/queue/result section during its heartbeat unless acting as Integrator G.
- Each completed heartbeat must have a matching `iteration-<RUN_ID>.md`.
- Commit hashes are required for completed implementation heartbeats. If no commit is created, the blocker must be explicit.

## Current Snapshot

Checklist count when parallel board was created:

| Metric | Count |
| --- | ---: |
| Open checklist items | 189 |
| Done checklist items | 23 |

## Active Workers

| Worker | Branch/worktree | Current queue head | Status | Last RUN_ID | Last commit | Blocker |
| --- | --- | --- | --- | --- | --- | --- |
| A | `codex/orca-ehr-worker-a-patient-boundary` | A-02 patientmodv2 prepare/send + canonical re-fetch | Done | 20260510T203921Z | this commit | - |
| B | `codex/orca-ehr-worker-b-chart-revision` | B-02 FINAL direct-write denial | Done | 20260510T203944Z | this commit | - |
| C | `codex/orca-ehr-worker-c-prescription` | C-02 finalize/change/stop/cancel/reissue API | Done | 20260510T204040Z | this commit | - |
| D | `codex/orca-ehr-worker-d-orca-operation` | D-04 follow-up billing/report reviewer packet result evidence | Done | 20260511T024210Z | this commit | - |
| E | `codex/orca-ehr-worker-e-medical-safety-ui` | E-02 common patient header staged rollout | Done | 20260510T204142Z | this commit | - |
| F | `codex/orca-ehr-worker-f-audit-security-gates` | F-02 credential/PHI leakage guards | Done | 20260510T201318Z | this commit | - |
| G | `codex/orca-ehr-integrator-g` | G-02 merge first worker batch in prescribed order | Done | 20260510T195822Z | this docs commit | - |

## Worker Queues

### Worker A Queue

| ID | Checklist scope | Task | Acceptance | Minimum verification |
| --- | --- | --- | --- | --- |
| A-01 | 2, 3.1, 4, 6, 13 | Implement `orca_patient_cache` contract and patientgetv2 official read wrapper with stale/source metadata. | Patient read never treats local cache as current ORCA source; patient-not-found maps to business status; stale cache is explicit. | Focused Maven tests, doc/config guards |
| A-02 | 3.1, 6 | Implement patientmodv2 prepare/send and post-send canonical re-fetch. | Local patient write is not marked updated on ORCA failure; canonical re-fetch is required before displayed sync confirmation. | Patientmodv2 focused tests, web patient API tests |
| A-03 | 3.3, 4, 6 | Implement `orca_acceptance_cache` and cancellation/diff detection contract. | Cancelled acceptance is recorded as status/event, not deletion; encounter warning is preserved. | Acceptance resource tests, doc/config guards |
| A-04 | 3.2, 4, 6 | Implement insurance cache and encounter insurance snapshot boundary. | Past snapshots do not change after ORCA insurance changes; resend shows diff. | Focused Maven tests |

### Worker B Queue

| ID | Checklist scope | Task | Acceptance | Minimum verification |
| --- | --- | --- | --- | --- |
| B-01 | 4.4, 7 | Add chart document/revision/event minimum migration and status enum. | Status is limited to `DRAFT`, `FINAL`, `AMENDED`, `ADDENDUM`, `CANCELLED`, `VOIDED`. | Persistence/entity checks, focused Maven tests |
| B-02 | 4.4, 7, 17 | Enforce FINAL direct-write denial for body, SOAP, modules, and title. | Direct updates return fail-closed errors and require revision/event paths. | Finalized write guard, focused tests |
| B-03 | 7 | Implement finalize API skeleton with required validation and content hash. | Finalize requires patient/encounter/department/physician/insurance/finalizer/content context and records hash. | Focused Maven tests |
| B-04 | 7, 14 | Implement amend/addendum/cancel revision/event APIs and chart export inclusion contract. | Original text is never physically deleted; reasons and before/after summaries are stored. | Focused Maven/reporting tests |

### Worker C Queue

| ID | Checklist scope | Task | Acceptance | Minimum verification |
| --- | --- | --- | --- | --- |
| C-01 | 4.5, 8 | Add prescription order revision/item/event schema and status enum. | Finalized prescriptions cannot be overwritten; item fields are structurally stored. | Persistence/entity checks, focused Maven tests |
| C-02 | 8 | Implement finalize/change/stop/cancel/reissue APIs. | Reasons are mandatory, events are append-only, original prescription stays readable. | Focused Maven tests |
| C-03 | 8, 10.1 | Implement chart/prescription to `orca_medical_candidate` prepare route. | Candidate is explicitly non-authoritative and unresolved items are `NEEDS_REVIEW` / unsendable. | Focused Maven tests |
| C-04 | 8, 10.2 | Add candidate UI/API confirmation surface for medical send preparation. | Patient/acceptance/department/physician/insurance/candidate data is shown without overwriting orders. | Web focused tests + typecheck |

### Worker D Queue

| ID | Checklist scope | Task | Acceptance | Minimum verification |
| --- | --- | --- | --- | --- |
| D-01 | 5, 9 | Introduce `OrcaApiResult` and map disease/medical statuses. | ORCA responses are not collapsed into success/failure; warning/unmatched/conflict/auth/cert/network statuses are distinct. | Adapter focused tests |
| D-02 | 4.6, 5 | Add `orca_operation`, `orca_transmission`, response summary, reconciliation result migration. | Idempotency/status/retry/request/response hash fields are persisted without raw credentials or raw ORCA body exposure. | Persistence/entity checks, focused Maven tests |
| D-03 | 5, 10.2 | Implement `medicalmodv2` send/re-fetch/reconcile with UNKNOWN fail-closed. | UNKNOWN is never success; re-fetch/reconcile is required before user-visible completion. | Medical adapter tests |
| D-04 | 10.3, 10.4 | Implement billing/income/report cache boundaries. | Billing, storage, receipt, and receipt/report data are ORCA-derived cache/snapshot only. | Focused Maven tests |

### Worker E Queue

| ID | Checklist scope | Task | Acceptance | Minimum verification |
| --- | --- | --- | --- | --- |
| E-01 | 11, 17, 20 Phase 4 | Close Section 17 UI wording/warning parent with guard and focused tests. | ORCA sent/accepted is not chart finalized/accounted/registered; critical warnings are not hidden by default. | Web guard, targeted Vitest, typecheck |
| E-02 | 11 | Build common patient header and apply to first major screens. | Patient identity, ORCA source/fetched/stale status, acceptance/department/physician/insurance are visible and stable. | Targeted Vitest, typecheck |
| E-03 | 11 | Build critical operation confirmation modal contract. | Patient identifiers are repeated in modal; finalize/send/cancel labels are distinct. | Targeted Vitest |
| E-04 | 11 | Reduce `disabled` dependency and show push-time reasons. | Missing requirements are displayed on action, or disabled controls have nearby reason/enabling condition. | UI/a11y tests |

### Worker F Queue

| ID | Checklist scope | Task | Acceptance | Minimum verification |
| --- | --- | --- | --- | --- |
| F-01 | 12, 15 | Define audit append-only/hash-chain contract and guard scaffolding. | No audit update/delete APIs; hash-chain validation path exists. | Guard script, focused Maven tests |
| F-02 | 13, 15 | Add credential/PHI leakage guards for logs, audit, web bundle, and test snapshots. | ORCA credentials and patient detail are not emitted to tracked outputs or browser bundle. | Web/server guards |
| F-03 | 14.3, 16 | Document and guard backup/restore/hash verification workflows. | Restore requires audit hash-chain and chart content-hash validation before ORCA re-alignment. | Doc links/config guards |
| F-04 | 18, 19 | Build real ORCA connection trial checklist execution harness with sanitized evidence policy. | Live evidence cannot include raw ORCA body, credentials, PHI, HAR, trace, video, or screenshots. | Release validation dry run |

### Integrator G Queue

| ID | Task | Acceptance | Minimum verification |
| --- | --- | --- | --- |
| G-01 | Create and maintain parallel work plan and board. | Plan and board are linked from workstream README and doc links pass. | Doc links |
| G-02 | After each worker batch, merge in prescribed order and resolve ownership conflicts. | No cross-worker migration/API/UI ownership conflict remains. | Focused cross-worker tests |
| G-03 | Maintain checklist/release-validation reconciliation. | Checked items have implementation evidence; release gates reflect current commands. | Doc/config guards |
| G-04 | Run daily integration gate. | Web CI and server static-analysis verify pass or blockers are documented. | `npm run ci`, Maven static verify |

## Heartbeat Results

Append newest rows at the top.

| RUN_ID | Worker | Queue item | Checklist item(s) | Commit | Verification | Result | Next task |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 20260511T034219Z | D | D-04 follow-up | 10.3/10.4 billing/report operator result template prints a no-write sanitized input contract and is accepted by the result wrapper | this commit | `node --test tests/review-packet/orca-billing-report-operator-template.test.mjs`, `node --test tests/review-packet/reviewer-submission-packet.test.mjs`, web guard, `ReleaseValidationRunbookContractTest`, docs/config/runtime lookup guards passed | Done | D-04 follow-up billing/report closeout evidence command-log guard |
| 20260511T032215Z | D | D-04 follow-up | 10.3/10.4 reviewer submission packet dry-run now lists required closeout/packet files and fails before output when billing/report result evidence is missing | this commit | `node --test tests/review-packet/reviewer-submission-packet.test.mjs`, `ReleaseValidationRunbookContractTest`, docs/config/runtime lookup guards, `git diff --check` passed | Done | D-04 follow-up billing/report closeout handoff/result operator example contract |
| 20260511T030339Z | D | D-04 follow-up | 10.3/10.4 reviewer submission packet now requires sanitized billing/report operator result evidence and rejects raw identifiers/artifacts/storage keys plus upload failure | this commit | `node --test tests/review-packet/reviewer-submission-packet.test.mjs`, `ReleaseValidationRunbookContractTest`, docs/config/runtime lookup guards, `git diff --check` passed | Done | D-04 follow-up billing/report closeout packet dry-run fixture |
| 20260511T024210Z | D | D-04 follow-up | 10.3/10.4 operator live billing/report result wrapper accepts only sanitized ORCA cache/snapshot hashes, counts, storage status, and rejects raw identifiers/artifacts/upload failure | this commit | direct Node assertions, CLI result ready/blocked leak scans, web guard pretest, `ReleaseValidationRunbookContractTest`, docs/config/runtime lookup guards passed; Vitest unavailable | Done | D-04 follow-up billing/report reviewer packet result evidence |
| 20260511T022207Z | D | D-04 follow-up | 10.3/10.4 live billing/report handoff requires ready dry-run summary, manual approval hash, sanitized/no-artifact mode, and rejects raw identifier/artifact flags before live traffic | this commit | direct Node assertions, CLI ready/blocked leak scans, web guard pretest, `ReleaseValidationRunbookContractTest`, docs/config/runtime lookup guards passed; Vitest unavailable | Done | D-04 follow-up live billing/report execution operator run |
| 20260511T020213Z | D | D-04 follow-up | 10.3/10.4 reviewer submission packet copies and validates only billing/report dry-run sanitized summary; rejects live execution claims and raw artifact/raw patient key references | this commit | `node --test tests/review-packet/reviewer-submission-packet.test.mjs`, `ReleaseValidationRunbookContractTest`, docs/config/runtime lookup guards passed | Done | D-04 follow-up live billing/report execution handoff |
| 20260511T014209Z | D | D-04 follow-up | 10.3/10.4 billing/report live dry-run harness validates candidate discovery + exact preflight and emits sanitized evidence only | this commit | direct Node assertions, dry-run CLI leak scan, web guard, `ReleaseValidationRunbookContractTest` passed | Done | D-04 follow-up billing/report sanitized evidence integration |
| 20260511T012208Z | D | D-04 follow-up | 10.3/10.4 ORCA billing/report live profile evidence boundary fixed to sanitized cache/snapshot hash and server-generated storage metadata only | this commit | `ReleaseValidationRunbookContractTest` passed | Done | D-04 follow-up billing/report live dry-run harness |
| 20260511T010209Z | D | D-04 follow-up | 10.3/10.4 release-validation now gates report resource, billing cache, and `orcaBillingCache` readiness coverage with runbook contract test | this commit | `ReleaseValidationRunbookContractTest`, `PublicRouteInventoryContractTest`, `WebXmlEndpointExposureTest`, `OrcaReportDocumentResourceTest`, `OrcaBillingCacheStoreTest`, `OperationsHealthResourceTest` passed | Done | D-04 follow-up ORCA billing/report live profile validation |
| 20260511T004209Z | D | D-04 follow-up | 10.3/10.4 report fetch pipeline stages binary object only from server-side snapshot receipt and fails closed on enabled upload failure | this commit | `OrcaReportDocumentResourceTest`, `OrcaBillingCacheStoreTest`, doc/config/runtime lookup guards passed | Done | D-04 follow-up release-gate billing/report coverage |
| 20260511T002208Z | D | D-04 follow-up | 10.3/10.4 public income/report resource tests for cache/snapshot command boundaries and fail-closed persistence failures | this commit | `OrcaReportDocumentResourceTest`, `OrcaChartSupportResourceTest` passed | Done | D-04 follow-up report fetch pipeline wiring |
| 20260511T000209Z | D | D-04 follow-up | 10.3/10.4 server-internal ORCA report binary uploader with digest/snapshot fail-closed checks | this commit | `OrcaBillingCacheStoreTest`, `FreshSchemaBaselineTest`, `OrcaReportDocumentResourceTest`, doc/config/runtime lookup guards passed | Done | D-04 follow-up billing/report integration tests |
| 20260510T232258Z | D | D-04 follow-up | 10.3/10.4 `storage_upload_status` / retention metadata gate for ORCA report snapshots | this commit | `OrcaBillingCacheStoreTest`, `FreshSchemaBaselineTest`, `OrcaReportDocumentResourceTest`, doc/config/runtime lookup guards passed | Done | D-04 follow-up report binary object uploader |
| 20260510T231812Z | D | D-04 follow-up | 10.3/10.4 server-generated `server_storage_object_key` / `server_storage_digest` for ORCA report snapshots | this commit | `OrcaBillingCacheStoreTest`, `FreshSchemaBaselineTest`, `OrcaReportDocumentResourceTest`, doc/config/runtime lookup guards passed | Done | D-04 follow-up report binary upload/retention gate |
| 20260510T230649Z | D | D-04 follow-up | 16 sanitized `orcaBillingCache` readiness gate for `orca_billing_cache` / `orca_report_snapshot` availability | this commit | `OperationsHealthResourceTest`, doc/config/runtime lookup guards passed | Done | D-04 follow-up report storage authority |
| 20260510T223031Z | D | D-04 | 10.3/10.4 `orca_billing_cache`; no local billing authority API; ORCA report snapshot/audit history; receipt/report data as ORCA-derived cache/snapshot | this commit | `OrcaBillingCacheStoreTest`, `FreshSchemaBaselineTest`, `OrcaChartSupportResourceTest`, `OrcaReportDocumentResourceTest`, doc/config/runtime lookup guards passed | Done | D-04 follow-up report storage authority + health/billing gates |
| 20260510T215931Z | D | D-03 | 4 `UNKNOWN` fail-closed for `medicalmodv2`; 10.2 post-send `tmedicalgetv2` re-fetch/reconcile foundation | this commit | `OrcaBillingCorrectionScenarioSupportTest`, doc/config/runtime lookup guards passed | Done | D-04 billing/income/report cache boundaries |
| 20260510T211550Z | D | D-02 | 4.6 common ORCA operation/transmission/response/reconciliation ledger | this commit | `OrcaOperationLedgerSchemaTest`, `FreshSchemaBaselineTest`, doc/config/runtime lookup guards passed | Done | D-03 `medicalmodv2` send/re-fetch/reconcile + UNKNOWN fail-closed |
| 20260510T204040Z | C | C-01 | 4.5 prescription authority schema/status; direct overwrite DB guard foundation | this commit | `PrescriptionAuthoritySchemaTest`, `FreshSchemaBaselineTest`, doc/config/runtime/finalized-write guards passed | Done | C-02 finalize/change/stop/cancel/reissue API |
| 20260510T204142Z | E | E-01 | 17 UI wording/warning parent; 20 Phase 4 guard foundation | this commit | `verify:medical-safety-ui-copy`, `verify:web-guard`, focused Charts Vitest, `typecheck` passed | Done | E-02 common patient header staged rollout |
| 20260510T204050Z | D | D-01 | Section 5 `OrcaApiResult` common model | this commit | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaApiResultTest,OrcaHttpClientSupportTest,OrcaHttpClientLogTest,OrcaChartSupportResourceTest,OrcaBillingCorrectionScenarioSupportTest test` passed | Done | D-02 `orca_operation` / `orca_transmission` migration |
| 20260510T203921Z | A | A-01 | 4 `orca_patient_cache`; 6 official patientgetv2 wrapper; 6 `ORCA_PATIENT_NOT_FOUND` business status | this commit | Focused Maven patient cache/resource/schema tests passed; doc/config/runtime lookup guards passed | Done | A-02 patientmodv2 prepare/send + canonical re-fetch |
| 20260510T203944Z | B | B-01 | 4.4 chart document/revision/event minimum schema; chart revision status enum | this commit | focused Maven tests and doc/config/runtime lookup guards passed | Done | B-02 FINAL direct-write denial |
| 20260510T201318Z | F | F-01 | 4.7 audit append-only/hash-chain; 12 audit append-only; 19 hash-chain gate; Phase 5 audit/hash-chain | this commit | `check-audit-append-only.sh`, focused Maven audit/guard tests passed | Done | F-02 credential/PHI leakage guards |
| 20260510T195822Z | G | G-01 | Parallel workstream docs | this docs commit | doc links/config/runtime lookup guards passed | Done | Start Worker F F-01 or Worker E E-01 |

## Integration Log

| RUN_ID | Integrator action | Included workers | Verification | Result |
| --- | --- | --- | --- | --- |
| 20260510T195822Z | Initialized parallel worker board and queues. | G | doc links/config/runtime lookup guards passed | Done |

## Blockers

| ID | Owner | Description | Impact | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

## Completion Rules

- A queue item is `Done` only after implementation, focused tests, required docs, iteration doc, worker-board update, and commit are complete.
- Checklist items are checked only when the user-facing and server-side requirement is actually satisfied.
- Release checklist sections 18 and 19 require live or release-gate evidence and cannot be closed by mock/unit tests alone.
