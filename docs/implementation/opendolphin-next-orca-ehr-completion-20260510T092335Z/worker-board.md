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
| Open checklist items | 178 |
| Done checklist items | 34 |

## Active Workers

| Worker | Branch/worktree | Current queue head | Status | Last RUN_ID | Last commit | Blocker |
| --- | --- | --- | --- | --- | --- | --- |
| A | `codex/orca-ehr-worker-a-patient-boundary` | Worker A queue complete; temporary reconcile parse guard | Done | 20260511T035005Z | this commit | - |
| B | `codex/orca-ehr-worker-b-chart-revision` | B-02 FINAL direct-write denial | Done | 20260510T203944Z | this commit | - |
| C | `codex/orca-ehr-worker-c-prescription` | C-02 finalize/change/stop/cancel/reissue API | Done | 20260510T204040Z | this commit | - |
| D | `codex/orca-ehr-worker-d-orca-operation` | D-02 `orca_operation` / `orca_transmission` migration | Done | 20260510T204050Z | this commit | - |
| E | `codex/orca-ehr-worker-e-medical-safety-ui` | E-02 common patient header staged rollout | Done | 20260510T204142Z | this commit | - |
| F | `codex/orca-ehr-worker-f-audit-security-gates` | F-04 real ORCA connection trial checklist execution harness | Done | 20260510T215924Z | this commit | - |
| G | `codex/orca-ehr-integrator-g` | G-02 merge first worker batch in prescribed order | Done | 20260510T195822Z | this docs commit | - |

## Worker Queues

### Worker A Queue

| ID | Checklist scope | Task | Acceptance | Minimum verification |
| --- | --- | --- | --- | --- |
| A-01 | 2, 3.1, 4, 6, 13 | Implement `orca_patient_cache` contract and patientgetv2 official read wrapper with stale/source metadata. | Patient read never treats local cache as current ORCA source; patient-not-found maps to business status; stale cache is explicit. | Focused Maven tests, doc/config guards |
| A-02 | 3.1, 6 | Implement patientmodv2 prepare/send and post-send canonical re-fetch. | Local patient write is not marked updated on ORCA failure; canonical re-fetch is required before displayed sync confirmation. | Patientmodv2 focused tests, web patient API tests |
| A-03 | 3.3, 4, 6 | Implement `orca_acceptance_cache` and cancellation/diff detection contract. | Cancelled acceptance is recorded as status/event, not deletion; encounter warning is preserved. | Acceptance resource tests, doc/config guards |
| A-04 | 3.2, 4, 6 | Implement insurance cache and encounter insurance snapshot boundary. | Past snapshots do not change after ORCA insurance changes; resend shows diff. | Focused Maven tests |
| A-05 | 3.1, 6, 13 | Harden route inventory guard for absent local patient CRUD and absent patient delete. | Only official patientmodv2 create/update, official patientgetv2, and local search are permitted; local patient mutation/delete aliases fail. | Route inventory/web.xml tests, web guard |
| A-06 | 3.1, 6, 13 | Harden patientgetv2 cache write failure behavior. | Cache write failure does not return a current-source success response; old cache is not promoted to live ORCA success. | Patient API focused tests |
| A-07 | 3.3, 6, 13 | Harden acceptlstv2 acceptance cache write failure audit boundary. | Cache write failure does not return a current-source success response; raw cache exception text is not copied into audit details; success cache counts are absent on failure. | Visit resource focused tests |
| A-08 | 3.3, 6, 13 | Guard acceptance cancellation cache events from mutating encounter workflow state. | `ORCA_ACCEPTANCE_CANCELLED` cache result does not directly delete/cancel `encounter_projection`; workflow warning/state changes require a separate server-side workflow. | Visit resource focused tests |
| A-09 | 3.3, 6, 13 | Fail closed normal billing send when server-derived ORCA acceptance is missing. | `close-and-send-to-billing` rejects missing ORCA acceptance before patient/karte/transport lookup; client-provided identifiers cannot fill the gap. | Billing workflow focused tests |
| A-10 | 3.3, 6, 13 | Reject client-provided acceptance/department/physician aliases on billing send. | Client-provided acceptanceId/date/time, departmentCode, physicianCode, insurance aliases are forbidden before encounter lookup. | Billing workflow focused tests |
| A-11 | 3.3, 6, 13 | Reject mismatched server-derived billing voucher on normal billing send. | `officialVisitIdentifiers.voucherNumber` must match `encounter_projection.orca_acceptance_id` before patient/karte/transport lookup. | Billing workflow focused tests |
| A-12 | 3.3, 6, 13 | Block new normal billing sends from closed or accounting-wait encounter states. | Existing idempotency results can be returned, but new idempotency sends fail closed before patient/karte/transport lookup when `business_state` is billing-closed. | Billing workflow focused tests |
| A-13 | 3.3, 6, 13 | Reject request bodies on temporary medical reconcile. | `reconcile-temporary-medical` uses only authenticated facility plus saved transmission/snapshot; body-bearing requests fail before audit/repository/ORCA lookup. | Billing workflow focused tests |
| A-14 | 3.3, 6, 13 | Require saved snapshot visit date and department for temporary medical reconcile. | `tmedicalgetv2` reconcile payload is not generated from fallback timestamps or empty department; incomplete snapshot fails before ORCA transport. | Billing correction focused tests |
| A-15 | 3.3, 6, 13 | Require sanitized server-derived snapshot metadata for temporary medical reconcile. | `tmedicalgetv2` reconcile payload is generated only from snapshots with raw-sensitive exclusion and server-derived authority flags. | Billing correction focused tests |
| A-16 | 3.3, 6, 13 | Require ORCA temporary medical response date to match saved snapshot when present. | `tmedicalgetv2` response rows with a different perform date are not counted as matching temporary medical candidates. | Billing correction focused tests |
| A-17 | 3.3, 6, 13 | Ignore temporary medical reconcile rows when ORCA Api_Result is non-normal. | Non-00 `tmedicalgetv2` responses do not count matching rows, `Medical_Uid` presence, or resend-block decisions. | Billing correction focused tests |
| A-18 | 3.3, 6, 13 | Sanitize unparseable temporary medical reconcile responses. | Parse failures or missing `Api_Result` return `apiResult=unknown`, sanitized message, and needs-review status without raw body or parser details. | Billing correction focused tests |

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
| 20260510T215924Z | F | F-04 | 18/19 live ORCA Trial execution harness and sanitized evidence policy | this commit | live trial dry-run harness, live ORCA harness guard, doc/config/runtime/audit/backup/sensitive guards passed; `RepoGuardScriptsTest` passed | Done | Worker F queue exhausted; support Integrator G release gates or new audit/security blocker |
| 20260510T211308Z | F | F-03 | 14.3 backup/restore/hash verification workflow; 16 backup restore ORCA re-alignment boundary | this commit | backup/restore, doc/config/runtime/audit/sensitive guards passed; `RepoGuardScriptsTest` passed | Done | F-04 real ORCA connection trial checklist execution harness |
| 20260511T035005Z | A | A-18 | 3.3/6/13 temporary reconcile parse failure sanitized | this commit | focused billing correction test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T033122Z | A | A-17 | 3.3/6/13 temporary reconcile non-normal Api_Result fail-closed | this commit | focused billing correction test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T031021Z | A | A-16 | 3.3/6/13 temporary reconcile response date mismatch rejected | this commit | focused billing correction test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T025019Z | A | A-15 | 3.3/6/13 temporary reconcile sanitized snapshot fail-closed | this commit | focused billing correction test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T023009Z | A | A-14 | 3.3/6/13 temporary reconcile snapshot context fail-closed | this commit | focused billing correction test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T020908Z | A | A-13 | 3.3/6/13 temporary reconcile request-body rejection | this commit | focused billing workflow test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T014810Z | A | A-12 | 3.3/6/13 billing-send closed-state fail-closed | this commit | focused billing workflow test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T012916Z | A | A-11 | 3.3/6/13 billing-send projection voucher mismatch fail-closed | this commit | focused billing workflow test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T010814Z | A | A-10 | 3.3/6/13 billing-send client authority aliases rejected | this commit | focused billing workflow test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T004806Z | A | A-09 | 3.3/6/13 missing ORCA acceptance blocks normal billing send | this commit | focused billing/visit resource tests and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T002812Z | A | A-08 | 3.3/6/13 acceptance cancellation cache event separated from encounter workflow mutation | this commit | focused visit resource/acceptance cache tests and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260511T000803Z | A | A-07 | 3.3/6/13 acceptance cache write failure fail-closed and sanitized audit boundary | this commit | focused visit resource test and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260510T233304Z | A | A-06 | 3.1/6 patient cache metadata and cache-write fail-closed behavior | this commit | focused patient API/cache tests and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260510T230645Z | A | A-05 | 3.1/6/13 local patient CRUD absent, patient delete absent, route inventory guard | this commit | focused route inventory/web.xml tests, web guard, doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260510T221955Z | A | A-04 | 3.2/4 insurance cache + immutable encounter insurance snapshot boundary | this commit | focused Maven insurance/resource/fresh schema tests and doc/config/runtime guards passed | Done | Await next Worker A queue item |
| 20260510T214903Z | A | A-03 | 3.3/4/6 `orca_acceptance_cache` 作成、acceptlstv2 inventory 保存、diff/cancel/needs-review event 化 | this commit | focused Maven acceptance/resource/fresh schema tests and doc/config/runtime guards passed | Done | A-04 insurance cache and encounter insurance snapshot boundary |
| 20260510T211011Z | A | A-02 | 3.1/6 patientmodv2唯一mutation route、送信前差分、送信後patientgetv2 canonical re-fetch、ORCA失敗時local未更新 | this commit | focused Maven patient tests, web patient API/UI tests, web guard, doc/config/runtime guards passed | Done | A-03 `orca_acceptance_cache` + cancellation/diff detection |
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
