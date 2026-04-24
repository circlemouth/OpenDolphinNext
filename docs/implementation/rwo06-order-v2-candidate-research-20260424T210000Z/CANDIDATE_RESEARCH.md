# RWO-06 Order-Family V2 Candidate Research

RUN_ID: `20260424T210000Z`

## Verdict

`ORDER_FAMILY_V2_CANDIDATE_RESEARCH_RECORDED`

This record captures public-source research for Trial-rejected `medicalmodv2` order-family v1 payloads. It does not authorize blind live retries and does not claim Trial business acceptance. The next worker must perform no-live payload construction, parser/sanitizer checks, wrapper dry-run, duplicate-live checkpointing, readiness checks, and endpoint-specific success criteria before any live Trial action.

## Sources

| Source | URL | Use |
|---|---|---|
| ORCA `medicalmodv2` API specification | <https://www.orca.med.or.jp/receipt/tec/api/medicalmod.html> | Endpoint/request structure and official sample patterns. |
| ORCA radiology/body-part API note | <https://www.orca.med.or.jp/receipt/users/tec/api/comment842-830-bui-api.html> | Radiology body-part and imaging-order caveats. |
| Social Insurance Medical Fee Payment Fund master index | <https://www.ssk.or.jp/seikyushiharai/tensuhyo/kihonmasta/> | Public master source for candidate medical fee codes. |
| Social Insurance Medical Fee Payment Fund 2026 master changes | <https://www.ssk.or.jp/seikyushiharai/tensuhyo/kihonmasta/r08kaiteijoho.html> | Public master update reference. |
| JP Core ProcedureCodesMedical code system | <https://jpfhir.jp/fhir/core/terminology/ig/CodeSystem-JP_ProcedureCodesMedical_CS> | Secondary terminology view citing the Payment Fund medical act master. |

## Candidate Queue

| Order family | Claim007 class | Candidate | Automation suitability | Required no-live checks before live |
|---|---:|---|---|---|
| `testOrder` / 検査 | `600` | `160000310` 尿中一般物質定性半定量検査 | Highest priority v2 smoke candidate. Low dependency compared with rejected order families. | Build v2 payload, verify class/code placement, parser success criteria, no duplicate accepted checkpoint, and Trial target readiness. |
| `radiologyOrder` / 画像診断 | `700` | `002000099` 頭 + `170027910` 単純撮影（デジタル撮影） | Strong candidate if body-part + imaging fee are modeled together. | Include body-part semantics; confirm generated payload avoids body-part-less radiology. Verify whether diagnosis fee auto-calculation is expected. |
| `surgeryOrder` / 手術 | `500` | `150003110` 皮膚、皮下腫瘍摘出術（露出部）（長径2cm未満） | Candidate appears in ORCA sample class context, but needs clinical consistency. | Check required disease/comment/anesthesia/material fields. Consider lighter `150001010` 創傷処理（長径5cm未満） if no-live checks show fewer dependencies. |
| `baseChargeOrder` / 基本診療料 | `110` | `111000110` 初診料 | Conditional candidate if Trial patient/encounter can satisfy first-visit conditions. | Confirm no same-day duplicate and target state supports first visit; otherwise use a revisit-class candidate from official sample context. |
| `injectionOrder` / 注射 | `310` | `130000510` 皮内、皮下及び筋肉内注射（1回につき） | Conditional candidate; likely requires an injection drug/material row in the same bundle. | Research/verify Trial-valid medication/material code and ensure fee + drug are represented as one valid set. |
| `instractionChargeOrder` / 指導料 | `130` | `113001810` 特定疾患療養管理料（診療所） | Poor generic smoke candidate; use only for a dedicated scenario. | Requires target disease/facility/monthly billing constraints. Do not use as first v2 smoke unless a matching Trial disease context is established. |

## Recommended Order

1. Prepare `testOrder/600` v2 with `160000310`.
2. Prepare `radiologyOrder/700` v2 with body part `002000099` and imaging fee `170027910`.
3. Prepare `surgeryOrder/500` v2 from the ORCA sample-aligned candidate, with required dependent fields.
4. Prepare `baseChargeOrder/110` only after confirming Trial encounter state.
5. Prepare `injectionOrder/310` only after identifying a valid paired injection drug/material row.
6. Defer `instractionChargeOrder/130` until a disease/facility/monthly-billing scenario is established.

## Claim Boundary

Allowed claim: public-source v2 candidate research exists for Trial-rejected order families.

Not claimed: no v2 payload has been no-live verified by this record, no live Trial retry has been executed, no order-family business success exists beyond prior accepted prescription/treatment identities, no all-order readiness, no fullflow readiness, no production ORCA readiness, no S3/object-storage readiness, and no final release readiness.

## Safety

- Credentials captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance details captured: `false`
- Diagnostic artifacts captured: `false`
- Raw artifacts committed or packaged: `false`
