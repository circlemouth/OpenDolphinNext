# RWO-06F/RWO-06G/RWO-06H V2 No-Live Preparation

RUN_ID: `20260425T030245Z`

## Result

`INSTRUCTION_BASE_INJECTION_V2_NO_LIVE_PREPARED`

The active automation handoff was already `completed`, so this run continued the roadmap queue by preparing the remaining source-backed order-family v2 candidates that had not yet reached no-live wrapper evidence:

- `instractionChargeOrder` / Claim007 class `130`
- `baseChargeOrder` / Claim007 class `110`
- `injectionOrder` / Claim007 class `310`

No live ORCA Trial request was executed in this run.

## Source-Backed Candidates

| Workflow | Candidate | Source basis | Caveat before live |
|---|---|---|---|
| `instruction-charge` | `113001810` 特定疾患療養管理料（診療所） | ORCA manual classifies 医学管理等 as `.130`; ORCA public materials identify `113001810` as 特定疾患療養管理料（診療所）. | Requires target disease/facility/monthly billing preconditions; no live retry until those are established. |
| `base-charge` | `111000110` 初診料 | ORCA manual classifies 初診 as `.110`; ORCA public materials identify `111000110` as 初診料. | Requires target encounter state that permits first-visit billing; avoid duplicate/same-day unsupported state. |
| `injection` | `130000510` 皮内、皮下及び筋肉内注射 plus paired drug/material rows | ORCA manual classifies 皮下・筋肉内注 as `.310`; public ORCA/payment-fund materials identify `130000510` as the procedure fee. | Procedure-only injection is likely insufficient; v2 keeps paired drug/material rows for a valid set candidate. |

Sources used:

- <https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-2/>
- <https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-1/>
- <https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-5/>
- <https://www.orca.med.or.jp/receipt/update/improvement/improvement_520/improve_rireki-848-2021-12-22.html>
- <https://ftp.orca.med.or.jp/pub/data/receipt/outline/revision/pdf/202410-kaisei-taiou-receipt-20241126.pdf>
- <https://ftp.orca.med.or.jp/pub/data/receipt/outline/update/improvement/pdf/PD-420-37-2009-06-25.pdf>

## Endpoint Identities

| Workflow | Entity | Claim007 class | Payload | SHA-256 | Duplicate-live checkpoint |
|---|---|---:|---|---|---|
| `instruction-charge` | `instractionChargeOrder` | `130` | `web-client/qa/payloads/phase4/medicalmodv2_instruction_charge_trial_reachability_v2.json` | `043c2a657746820a96950d6c05e2179d65040123d677a028e9ab86bc9af98858` | `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-043c2a657746820a96950d6c05e2179d65040123d677a028e9ab86bc9af98858` |
| `base-charge` | `baseChargeOrder` | `110` | `web-client/qa/payloads/phase4/medicalmodv2_base_charge_trial_reachability_v2.json` | `4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a` | `rwo06g:medicalmodv2:rwo06g-base-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a` |
| `injection` | `injectionOrder` | `310` | `web-client/qa/payloads/phase4/medicalmodv2_injection_trial_reachability_v2.json` | `1af0b23246e8f9ee79879b28a09888ecc719ec8f6381e2b798cd63fa020e3300` | `rwo06h:medicalmodv2:rwo06h-injection-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-1af0b23246e8f9ee79879b28a09888ecc719ec8f6381e2b798cd63fa020e3300` |

## No-Live Result

All three v2 payloads passed the safe `medicalmodv2` wrapper dry-run with sanitized-only evidence:

- live Trial action: `not_run`
- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- request class: `medicalmodv2`
- target: `00001`
- Request_Number `01` only
- Request_Number `02` / `03` / `04` forbidden by this wrapper
- required entity kinds present
- allowed medical classes only
- raw payload/body stored: `false`

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| Repeating rejected v1 payload identities | Rejected: each v2 payload has a distinct SHA/checkpoint; no v1 live send was repeated. |
| Treating no-live dry-run as business success | Rejected: live Trial was not executed and business success remains `not_applicable_no_live_preparation_only`. |
| Using this wrapper for update/delete/cancel semantics | Rejected: the wrapper remains Request_Number `01` only and blocks `02` / `03` / `04`. |
| Committing raw ORCA or diagnostic artifacts | Rejected: only sanitized wrapper summaries and docs were written. |

## Verification

| Check | Result |
|---|---|
| `qa-phase4-safe-medicalmodv2.mjs --dry-run --workflow instruction-charge ...` | pass / no live ORCA |
| `qa-phase4-safe-medicalmodv2.mjs --dry-run --workflow base-charge ...` | pass / no live ORCA |
| `qa-phase4-safe-medicalmodv2.mjs --dry-run --workflow injection ...` | pass / no live ORCA |
| `npm --prefix web-client test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | pass |
| Forbidden artifact file scan for this evidence directory | pass / zero hits |
| Focused secret/raw-artifact text scan for this evidence directory and payload files | pass / zero hits |

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [instruction dry-run summary](instruction-charge-v2-dry-run/phase4-medicalmodv2-summary.sanitized.json)
- [base-charge dry-run summary](base-charge-v2-dry-run/phase4-medicalmodv2-summary.sanitized.json)
- [injection dry-run summary](injection-v2-dry-run/phase4-medicalmodv2-summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [secret-scan.sanitized.txt](secret-scan.sanitized.txt)

## Claim Boundary

This run does not claim `instractionChargeOrder/130`, `baseChargeOrder/110`, or `injectionOrder/310` Trial acceptance; all-guidance-fee/base-charge/injection coverage; broad all-order readiness; `diseasev3` acceptance; `subjectivesv2` acceptance; Request_Number `02` / `03` / `04`; fullflow readiness; production ORCA readiness; S3/object-storage readiness; broad clinical release readiness; or final release GO.

Credentials captured: `false`

Diagnostic artifacts captured: `false`

Raw artifacts committed or packaged: `false`

## Next Step

Run sanitized runtime readiness plus duplicate-checkpoint preflight for one v2 identity at a time. Recommended order: `baseChargeOrder/110` only if the Trial encounter state permits first-visit billing; otherwise `injectionOrder/310` after confirming the paired drug/material set. Keep `instractionChargeOrder/130` blocked until disease/facility/monthly-billing preconditions are established.
