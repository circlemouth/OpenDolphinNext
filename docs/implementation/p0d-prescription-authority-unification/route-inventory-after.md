# P0-D Route Inventory After

RUN_ID: `20260514T202715Z`

## Purpose

P0-D 完了後の public route inventory を、release validation と reviewer deliverable の両方で参照できる形に固定する。

この文書は「完了後に何が残るべきか」を示す target inventory であり、現 worktree の実装状態そのものを成功扱いにはしない。

## Required Public Taxonomy After P0-D

### official

- `/api/orca/official/*`
- ORCA official patient / visit / chart-support / billing / report 系のみ

### master

- `/api/orca/master/*`
- ORCA master read/query 系のみ

### local

- `/api/local/*`
- 処方 mutation は `/api/local/prescription-orders/authority*` のみ

### admin-internal

- `/api/admin/internal/*`
- sync/status など internal-only surface のみ

## Prescription Surface After P0-D

### Allowed

- `GET /api/local/prescription-orders`
- `POST /api/local/prescription-orders/authority`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/finalize`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/change`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/stop`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/cancel`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/reissue`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/resend`

### Forbidden

- `POST /api/local/prescription-orders`
- `POST /api/local/prescription-orders/do-import`
- any `PUT` / `PATCH` / `DELETE` under `/api/local/prescription-orders*`
- any public `/api/prescriptions*`
- any legacy alias, import shim, fallback write route, or taxonomy-external prescription mutation route

## Validation Hooks

- `PublicRouteInventoryContractTest`
- `WebXmlEndpointExposureTest`
- `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts`
- `bash scripts/ci/verify-ehr-orca-round3-guards.sh`

## Current Worktree Delta

2026-05-15 時点のこの worktree では、target と current state に次の差分が残る。

- `PublicRouteInventoryContractTest` はまだ legacy mutation route を expected set に含めている。
- `OpenDolphinRestApplication` / `LocalPrescriptionOrderResource` はまだ旧 local write surface を提供している前提で読める。
- `web-client/src/features/charts/prescriptionOrderApi.ts` は save path で `POST /api/local/prescription-orders` を使用している。

したがって、この文書は「route inventory after」の target 定義であり、現 worktree に対する PASS 証跡ではない。
