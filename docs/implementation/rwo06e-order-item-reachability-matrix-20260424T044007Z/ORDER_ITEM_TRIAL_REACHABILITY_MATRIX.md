# RWO-06E Order Item Trial Reachability Matrix

RUN_ID: `20260424T044007Z`

## Scope

This is a sanitized static matrix for exhaustive order-item Trial reachability planning. It did not execute WebORCA Trial traffic, production ORCA traffic, browser fullflow, screenshots, HAR, traces, videos, raw network capture, raw ORCA request/response bodies, or S3/object-storage setup.

The exhaustive unit for this roadmap is the current app's clinical surface plus ORCA-sendable order entity and Claim007 class-code families, not every ORCA master item code. Individual ORCA master codes are dynamic operational data and must be sampled through endpoint-specific payload identities only after the class/entity wrapper is safe.

## Source Inventory

- Web catalog: `web-client/src/features/charts/orcaMedicalClassCatalog.ts`
- Web UI registry: `web-client/src/features/charts/orderCategoryRegistry.ts`
- Document UI: `web-client/src/features/charts/DocumentCreatePanel.tsx`
- Server catalog: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalClassCatalog.java`
- Existing live Trial evidence:
  - Prescription `medOrder` class `212`: RUN_ID `20260424T031608Z`
  - Representative treatment `treatmentOrder` class `400`: RUN_ID `20260424T031608Z`

## Misuse Cases Checked

| Misuse case | Control in this matrix |
|---|---|
| Treating representative treatment/generic acceptance as all order-item coverage. | Each sendable entity/class family has its own row and status; only `medOrder/212` and `treatmentOrder/400` are marked accepted. |
| Treating `指導料` as covered by treatment/generic evidence. | `instractionChargeOrder` is separated and remains `no_live_verified`; class `130/132/133/140/141/142/143/148/149` require dedicated payload identities. |
| Running live Trial mutations for all classes without safe wrappers. | Every unaccepted live row requires no-live payload contract, sanitizer/parser test, dry-run, readiness 2xx, and duplicate-live checkpoint before execution. |
| Claiming local-only/import-only entities as ORCA Trial accepted. | `otherOrder`, `physiologyOrder`, and `bacteriaOrder` remain fail-closed/non-claim rows. |
| Treating clinical document creation or `文書料` as already ORCA-sendable. | Clinical documents are separated from ORCA order sending; current `文書料` examples are `otherOrder` / `LOCAL_OTHER:*` and remain local-only fail-closed. |

## Clinical Surface Matrix

| Surface | Current implementation | ORCA Trial status | Required next safe action |
|---|---|---|---|
| Karte clinical document save | `DocumentCreatePanel` plus `/karte/document` and letter-history paths | `local_server_component_static_only`; not an ORCA Trial order item | Keep in browser/fullflow/local persistence gates. Do not claim ORCA order acceptance from document-save evidence. |
| Document output / print / PDF preview | `ChartsDocumentPrintPage` / `ChartsOutpatientPrintPage` | `local_ui_static_only`; not an ORCA Trial order item | Keep artifact-free browser/print safety evidence separate from ORCA mutation evidence. |
| Document fee `文書料` | Current tests seed `otherOrder` with `LOCAL_OTHER:CERTIFICATE_FEE` | `not_applicable_fail_closed`; `otherOrder` is local-only and not sendable | If the release requires ORCA billing for document fees, define a separate business mapping to a sendable charge class first; do not infer it from `otherOrder`. |

## Exhaustive ORCA Entity/Class Matrix

| Entity | UI label | Claim007 class codes | Send policy | Current Trial status | Required next safe action |
|---|---:|---|---|---|---|
| `medOrder` | 処方 | `211`, `212`, `221`, `222`, `231`, `232` | sendable | `212` is `live_accepted_prescription_specific_payload`; remaining class codes are `no_live_verified` | Do not repeat accepted `212` checkpoint. Add separate representative payload identities only if release claim requires those remaining prescription class variants. |
| `injectionOrder` | 注射 | `310`, `311`, `312`, `320`, `321`, `330`, `331`, `334`, `340`, `350` | sendable | RWO-06H created a safe `310` v1 payload identity and no-live route, but the single live Trial attempt was `businessRejected`; remaining class codes are `no_live_verified` | Do not repeat v1. Identify a sanitized v2 `310` candidate or classify as pending business/Trial data decision; continue to surgery only with a separate payload identity. |
| `treatmentOrder` | 処置 | `400`, `401`, `402`, `403`, `409` | sendable | `400` is `live_accepted_representative_treatment_payload`; remaining class codes are `no_live_verified` | Do not repeat accepted `400` checkpoint. Add separate representative payload identities for remaining treatment class variants if needed. |
| `surgeryOrder` | 手術 | `500`, `501`, `502`, `510` | sendable | `no_live_verified` | Define surgery representative payload identities and endpoint-specific business-success criteria before Trial execution. |
| `testOrder` / `laboTest` | 検査 | `600`, `601`, `602`, `603`, `610` | sendable | `no_live_verified` | Define specimen/lab test payload identities. Keep local-only instructions/memos out of ORCA evidence. |
| `radiologyOrder` | 画像診断 | `700`, `701`, `702`, `703`, `704`, `731`, `732` | sendable | `no_live_verified` | Define radiology payload identities, including body-part handling only where allowed; no raw body evidence. |
| `baseChargeOrder` | 基本料 | `110`, `114`, `120`, `124` | sendable | RWO-06G created a safe `110` v1 payload identity and no-live route, but the single live Trial attempt was `businessRejected`; remaining class codes are `no_live_verified` | Do not repeat v1. Identify a sanitized v2 `110` candidate or classify as pending business/Trial data decision; continue to unblocked rows only with separate payload identities. |
| `instractionChargeOrder` | 指導料 | `130`, `132`, `133`, `140`, `141`, `142`, `143`, `148`, `149` | sendable | RWO-06F created a safe `130` v1 payload identity and no-live route, but the single live Trial attempt was `businessRejected`; RWO-06F2 classified v2 as pending business/Trial data decision; remaining class codes are `no_live_verified` | Do not repeat v1. Keep class `130` blocked until a justified v2 candidate exists; then continue to remaining class families only with separate payload identities. |
| `otherOrder` | その他 | none | local-only, not sendable | `not_applicable_fail_closed` | Keep local-only and fail closed for ORCA Trial claims. |
| `physiologyOrder` | 生理検査 | `600` | import-only / blocked send carrier | `not_applicable_fail_closed` | Keep blocked until an official ORCA carrier and safe wrapper are explicitly approved. |
| `bacteriaOrder` | 細菌検査 | `600` | local-only / blocked send carrier | `not_applicable_fail_closed` | Keep local-only and fail closed for ORCA Trial claims. |

## Priority Queue

1. Confirm document surfaces remain local/browser/fullflow gates and not ORCA order claims; if `文書料` billing is required, first define a business mapping out of `otherOrder`.
2. `injectionOrder` representative `310` 注射 is safely tested but Trial-rejected; do not repeat v1 without a justified v2 candidate.
3. `surgeryOrder` representative `500` 手術.
4. `testOrder` representative `600` 検査.
5. `radiologyOrder` representative `700` 画像診断.
6. `baseChargeOrder` representative `110` 基本診療料 only after a business/Trial data decision identifies a justified v2 candidate.
7. `instractionChargeOrder` representative `130` 指導料 / 医学管理等 only after a business/Trial data decision identifies a justified v2 candidate.
8. Remaining class-code variants only after representative class evidence proves the wrapper/parser is safe and the release claim requires finer coverage.

## Live Execution Requirements

Before any unaccepted row can be run live:

- Payload identity must include entity, Claim007 class code, target, Request_Number `01`, API class `01`, payload SHA-256, and duplicate-live checkpoint key.
- No-live contract tests must prove that local-only fields, owner/facility/client-provided storage fields, raw patient details, and forbidden Request_Number `02/03/04` cannot pass.
- Wrapper dry-run must pass without raw ORCA request/response bodies.
- Status-only health/readiness must be 2xx.
- Sanitized parser must require endpoint-specific completion evidence, not just HTTP 200 or zero-like `apiResult`.
- Evidence must scan clean for credentials, raw ORCA bodies, raw patient/insurance detail, screenshots, HAR, traces, videos, and raw-network artifacts.

## Claim Boundary

This matrix does not claim that all order items pass ORCA Trial. It makes the full current app clinical/order surface explicit and queues the missing safe checks. Current accepted live evidence remains limited to `medOrder/212` and `treatmentOrder/400` endpoint-specific payload identities. RWO-06F/RWO-06G/RWO-06H added safe wrapper evidence for `instractionChargeOrder/130`, `baseChargeOrder/110`, and `injectionOrder/310`, but each v1 live Trial result was `businessRejected`, not accepted. Document save/output evidence remains separate from ORCA order mutation evidence.
