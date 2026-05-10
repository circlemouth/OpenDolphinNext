# OpenDolphinNext ORCA EHR Parallel Heartbeat Plan

- Status: active parallel execution plan
- RUN_ID: `20260510T195822Z`
- Created: 2026-05-10
- Primary checklist: [opendolphin-next-orca-ehr-implementation-checklist.md](./opendolphin-next-orca-ehr-implementation-checklist.md)
- Worker board: [worker-board.md](./worker-board.md)

## Purpose

This document replaces the single-worker heartbeat queue for the OpenDolphinNext ORCA EHR completion workstream. The checklist remains the requirements source of truth. This plan defines worker ownership, branch/worktree boundaries, hourly heartbeat protocol, merge order, and verification gates so multiple workers can safely progress the remaining checklist in parallel.

Current checklist count at plan creation:

- Open items: 189
- Done items: 23

## Source Boundaries

- Do not add `Owner:` labels to checklist items. Ownership lives in this plan and completion evidence lives in iteration docs plus [worker-board.md](./worker-board.md).
- Durable runtime contracts remain under `docs/contracts/`.
- Web client current contracts remain under `web-client/notes/`.
- Release validation remains under `docs/runbooks/release-validation.md`.
- `client/` and `server/` remain legacy references and must not be edited without explicit owner instruction.

## Parallel Work Rules

- Each worker uses a dedicated worktree and branch. Branch names should use the `codex/` prefix and include the worker id, for example `codex/orca-ehr-worker-a-patient-boundary`.
- Each worker owns the files and domains listed below. Cross-owned files require Integrator G approval before editing.
- Each heartbeat is one hour by default and must end with a commit or a documented blocker.
- A worker can own a large functional area, but each heartbeat must close a small, testable unit.
- Client-provided facility, owner, role, URL, storage key, digest, voucher, sequential, insurance combination, ORCA identifiers, and runtime endpoint values are not authority. They must be resolved or verified server-side.
- Tracked files must not contain raw credentials, Cookies, Authorization headers, JSESSIONID, CSRF tokens, raw ORCA bodies, patient names, addresses, phone numbers, insurance details, HAR, traces, videos, or screenshots.

## Worker Allocation

| Worker | Name | Checklist scope | Primary paths | First three heartbeats |
| --- | --- | --- | --- | --- |
| A | ORCA Source Boundary / Patient, Insurance, Acceptance | 2, 3.1, 3.2, 3.3, 6, 13 | `server-modernized/`, `domain/`, `persistence/`, `api-contract/`, `docs/contracts/orca-*`, `docs/contracts/runtime-config.md` | `orca_patient_cache` + patientgetv2 official read wrapper; patientmodv2 prepare/send + canonical re-fetch; `orca_acceptance_cache` + cancellation/diff detection |
| B | Chart Authenticity / Revision | 4.4, 7, 14 chart portions | `server-modernized/`, `domain/`, `persistence/`, `reporting/`, `docs/contracts/document-integrity.md` | chart document/revision/event migration + status enum; FINAL direct-write rejection tests; finalize API + content hash/snapshot hook |
| C | Prescription Authority / Medical Candidate | 4.5, 8, 10.1, 10.2 | `server-modernized/`, `domain/`, `persistence/`, `api-contract/`, `web-client/src/features/charts` prescription slices | prescription revision/item/event schema + overwrite guard; finalize/change/stop/cancel/reissue API; chart/prescription to `orca_medical_candidate` prepare route |
| D | ORCA Adapter / Operation / Billing | 4.6, 5, 9 remaining item, 10.2-10.4, 16 | `server-modernized/`, `api-contract/`, `docs/contracts/orca-connection.md`, `docs/runbooks/orca-outage-recovery.md` | `OrcaApiResult` model + status classification; operation/transmission/summary/reconciliation migration; `medicalmodv2` send/re-fetch/reconcile + UNKNOWN fail-closed |
| E | Medical Safety UI / DADS | 11, 17 remaining parent, 20 Phase 4 | `web-client/`, `docs/web-client/ux/`, `web-client/notes/ui-current-contract.md` | close Section 17 wording/warning parent via guard/tests; common patient header staged rollout; common critical-operation confirmation modal |
| F | Audit / Security / Backup / Test Gates | 12, 13, 14.3, 15, 16.2-16.4, 18, 19 | `server-modernized/tools/ci/`, `tests/`, `ops/`, `docs/runbooks/`, `docs/operations/`, `docs/releases/` | audit append-only/hash-chain contract + guard scaffolding; credential/PHI leakage guards; backup/restore/hash verification runbook + CI hooks |
| G | Integrator / Merge / Release Gate | Cross-worker integration | `docs/implementation/...`, `docs/runbooks/release-validation.md`, merge branches | collect worker commits/results; detect migration/API/docs conflicts; run focused cross-worker gates on merged mainline |

## Worker Prohibitions

| Worker | Prohibited without Integrator G approval |
| --- | --- |
| A | Chart revision schema, prescription revision schema, large patient header UI changes |
| B | Prescription-only revision schema, ORCA transmission tables |
| C | Live `medicalmodv2` adapter/send implementation, broad DADS/UI redesign |
| D | patientmodv2 mutation implementation, chart/prescription authoritative write logic |
| E | Server-side authorization or persistence enforcement as UI-only behavior, API contract changes without the owning backend worker |
| F | Core business table schema decisions without Worker B/C/D alignment |
| G | New feature implementation beyond integration fixes and release/checklist coordination |

## Hourly Heartbeat Protocol

Every worker heartbeat must follow this exact sequence:

1. Capture `RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)`.
2. Run `git status --short` and `git branch --show-current`.
3. Read the workstream README, checklist, [worker-board.md](./worker-board.md), and the worker-specific contracts.
4. Select one task from the worker queue that can be completed in one hour.
5. Record the assets, trust boundary, attack surface, and at least three misuse cases before implementation.
6. Implement the smallest complete slice.
7. Run focused tests and relevant docs/config guards.
8. Mark only genuinely completed checklist items as `[x]`.
9. Add an `iteration-<RUN_ID>.md` file and update [worker-board.md](./worker-board.md).
10. Stage only the worker's changes and commit.
11. Report with `【ワーカー報告】`, including RUN_ID, selected checklist item, implementation summary, threats/countermeasures, verification commands/results, updated docs, residual risk, next task, and commit hash.

## Worker-Specific Read Requirements

All workers read:

- [README.md](./README.md)
- [opendolphin-next-orca-ehr-implementation-checklist.md](./opendolphin-next-orca-ehr-implementation-checklist.md)
- [worker-board.md](./worker-board.md)
- `docs/README.md`
- `docs/managerdocs/README.md`
- `web-client/README.md`
- `docs/architecture/server-modernization-overview.md`
- `docs/runbooks/release-validation.md`

Additional required reads:

- Worker A: `docs/contracts/orca-route-taxonomy.md`, `docs/contracts/orca-connection.md`, `docs/contracts/runtime-config.md`, `web-client/notes/security-spec.md`.
- Worker B: `docs/contracts/document-integrity.md`, `docs/contracts/patient-context.md` if present, `web-client/notes/security-spec.md`.
- Worker C: `docs/contracts/document-integrity.md`, ORCA medical/order related contracts, `web-client/notes/ui-current-contract.md` for any prescription UI touch.
- Worker D: `docs/contracts/orca-route-taxonomy.md`, `docs/contracts/orca-connection.md`, `docs/contracts/orca-master-api.md`, `docs/runbooks/orca-outage-recovery.md`.
- Worker E: `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`, `docs/web-client/ux/web-client-ui-guideline.md`, `web-client/notes/ui-current-contract.md`, `web-client/notes/security-spec.md`.
- Worker F: `docs/contracts/health-endpoints.md`, `docs/contracts/runtime-config.md`, `docs/contracts/orca-connection.md`, `docs/runbooks/release-validation.md`, `docs/runbooks/reviewer-submission-packet.md`.
- Worker G: all worker iteration docs created since the previous integration pass, plus release validation and checklist.

## Merge Order

Integrator G merges in this order unless a blocker requires reordering:

1. Worker F guard/docs-only changes.
2. Worker A and Worker D ORCA boundary/adapter contracts.
3. Worker B and Worker C DB migrations and authoritative models.
4. Worker E UI changes.
5. Integrator G checklist, worker-board, and release-validation reconciliation.

If two workers touch the same migration, API DTO, route contract, UI component, or release gate, Integrator G stops one worker and assigns a single owner for that surface.

## Minimum Verification Gates

Use the smallest relevant subset per heartbeat, then escalate at integration boundaries.

### Web

```bash
cd web-client && npm run verify:web-guard
cd web-client && npm run typecheck
cd web-client && npm test -- --run <test-file>
```

### Server

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=<TestClass> test
```

### Docs / Config

```bash
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
```

### Integrator Daily Gate

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

Live ORCA evidence must follow the sanitized evidence policy in `docs/runbooks/release-validation.md`.

## Completion Accounting

- Checklist completion is requirements-based, not commit-count based.
- [worker-board.md](./worker-board.md) is the operational ledger for worker assignment and heartbeat results.
- `iteration-<RUN_ID>.md` files are the evidence index for each heartbeat.
- Release gates in checklist sections 18 and 19 must not be checked from mock tests alone.
