# RWO-06F Official Spec Context Map

RUN_ID: `20260428T063423Z`

## Scope

This is sanitized no-live intake for `RWO-06F` / `instractionChargeOrder` / `指導料` / class `130`.

The input was a ChatGPT ORCA official-spec research response supplied by the owner. The response was reviewed against current repo evidence and official ORCA documentation before being converted into this repo-local handoff material.

## Classification

| Blocker | Classification | Automation stance |
|---|---|---|
| `RWO-06F` instruction charge business context | `no_live_readonly_docs_static_progress_possible` | Continue with official-spec docs, no-live endpoint packet hardening, and sanitized read-only context preflight/carry-forward. Do not run live mutation yet. |
| `RWO-11/RWO-09` rollback/operator/final owner decision | `external_owner_operator_release_management_gate` | Preserve as external. Automation may record sanitized external evidence only; it must not execute or infer gate completion. |

## Official Source Map

| Source | Checked date | Used for | Derived repo action |
|---|---:|---|---|
| `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html` | 2026-04-28 | API endpoint taxonomy and `Request_Number` / `class` selection boundary | Keep `medicalmodv2` mutation and read-only preflight endpoints separate. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html` | 2026-04-28 | `medicalmodv2` create/delete/change/add semantics | Treat `medicalmodv2?class=01` as live mutation and require a complete endpoint packet before any send. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/medicalinfo.html` | 2026-04-28 | `medicalgetv2` read-only medical information classes | Use for monthly/day/class duplicate and context classification only. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/disease.html` | 2026-04-28 | `diseasegetv2` patient disease read-only return | Use for disease-context observation only; not business approval. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/systemkanri.html` | 2026-04-28 | `system01lstv2` system-management information by `Request_Number` | Use for department/physician/facility read-only classification where wrappers exist. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/system_daily.html` | 2026-04-28 | `system01dailyv2` ORCA linkage basic information | Use for sanitized facility/system setting observation only. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/medicationgetv2.html` | 2026-04-28 | medication/input code lookup and selectable comment candidates | Use to prove candidate code validity and comment-candidate status without raw detail. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/insurancecombi.html` | 2026-04-28 | patient insurance-combination list | Use only as sanitized insurance-combination readiness; do not store raw insurance detail. |
| `https://www.orca.med.or.jp/receipt/users/tec/api/master_last_update.html` | 2026-04-28 | master update date | Use for master freshness preflight. |
| `https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-2/` | 2026-04-28 | official operation-manual context for management fees | Support class `130` business-context uncertainty; not live authorization. |
| `https://orcamanual.orca.med.or.jp/gairai/chapter/2-5-3/` | 2026-04-28 | official operation-manual class/code search context | Support class `130` classification; not live authorization. |

## Endpoint Mapping

| Endpoint / selector | Mutation? | RWO-06F usage |
|---|---:|---|
| `/api21/medicalmodv2?class=01` | yes | Future live create path only after complete endpoint packet and owner/operator business context. |
| `/api21/medicalmodv2?class=02` | yes | Not part of current RWO-06F create preflight. |
| `/api21/medicalmodv2?class=03` | yes | Not part of current RWO-06F create preflight. |
| `/api21/medicalmodv2?class=04` | yes | Not part of current RWO-06F create preflight. |
| `/api01rv2/medicalgetv2?class=02/03/04` | no | Candidate monthly/day/class duplicate and department/insurance context classification. |
| `/api01rv2/diseasegetv2?class=01` | no | Disease context classification only. |
| `/api01rv2/system01lstv2` with `Request_Number` | no | Department/physician/facility classification where safe wrapper exists. |
| `/api01rv2/system01dailyv2` | no | Facility/system setting observation only. |
| `/api01rv2/medicationgetv2` | no | Candidate code validity and selectable-comment preflight. |
| `/api01rv2/patientlst6v2` | no | Sanitized insurance-combination readiness. |
| `/api01rv2/masterlastupdatev3` | no | Master freshness checkpoint. |
| `/orca22/diseasev3` / disease mutation | yes | Out of scope for RWO-06F read-only preflight. |
| `/api01rv2/acsimulatev2` | simulation / not pure read-only | Do not select as the next preflight without explicit owner/operator simulation approval and a sanitized evidence plan. |

## Precondition Gap Table

| Precondition | Officially probe-able without mutation? | Existing repo evidence | Next automation action | Owner/operator gap |
|---|---:|---|---|---|
| candidate code validity | yes, via `medicationgetv2` and master freshness | v2 payload and dry-run exist; row validity should be refreshed under this schema | Add/verify sanitized code-validity and comment-candidate fields | Which class-130 code is clinically/billing appropriate remains human judgment. |
| disease context | yes, via `diseasegetv2?class=01` | `not_proven` in `20260427T074616Z` evidence | Keep fail-closed; refine schema to distinguish absent/proven/blocked without raw disease names | Whether disease context satisfies the target management fee is human judgment. |
| facility/system context | partially, via `system01dailyv2` / `system01lstv2` | facility summary observed, not a business approval | Record only observed flags and non-claim boundary | Facility standard/notification eligibility remains human judgment. |
| monthly duplicate context | yes, via `medicalgetv2` | `not_proven`; prior result was nonzero numeric | Harden duplicate-checkpoint schema; do not classify as live-ready | Whether same-month coexistence is permitted remains human judgment. |
| department/physician context | yes, via `system01lstv2` where wrapper exists | not fully proven in prior evidence | Add department/physician valid/invalid/blocked statuses | Which department/physician is correct remains human judgment. |
| insurance combination context | yes, via `patientlst6v2` and/or read-only medical context | not fully proven; client-provided authority forbidden | Add active-combo count/presence statuses only; no raw insurance detail | Which insurance combination to bill remains human judgment. |
| live mutation readiness | no | not ready | Stop before live until all no-live/read-only and owner/operator context gates are satisfied | Explicit owner/operator decision required before live. |

## Next Work Queue

1. `RWO-06F_OFFICIAL_SPEC_CONTEXT_MAP_DOCS_ONLY`
   - This evidence file is the intake.
   - A later worker should validate/extend it from official sources only if needed.
2. `RWO-06F_NO_LIVE_PRECONDITION_PACKET_HARDENING`
   - Harden the existing v2 no-live endpoint packet.
   - Required fields: candidate code validity, selectable-comment status, disease/facility/monthly/department/physician/insurance statuses, duplicate checkpoint, parser/sanitizer contract, stop conditions, business-success separation.
3. `RWO-06F_READONLY_CONTEXT_PREFLIGHT_OR_CARRY_FORWARD`
   - Run only if approved non-S3 Trial runtime and safe read-only wrappers are available.
   - Otherwise write sanitized carry-forward evidence.

## Stop Conditions

- Any live `medicalmodv2` mutation would be required.
- Official semantics would need to be guessed.
- Raw ORCA request/response body, patient detail, disease detail, insurance detail, credential, cookie, session, Authorization header, CSRF value, HAR, trace, screenshot, video, or raw network dump would need to be read into committed evidence.
- Production ORCA or S3/object-storage would be required.
- HTTP 200, `Api_Result`, wrapper success, dry-run pass, or read-only preflight would be treated as business success.
- RWO-11/RWO-09 external owner/operator gate would be selected as automation execution work.

## Claim Boundary

This document supports only RWO-06F docs/no-live/read-only next work. It does not claim RWO-06F business acceptance, class `130` billing eligibility, all guidance-fee coverage, fullflow success, rollback rehearsal, operator acceptance, final owner GO/NO-GO/PENDING, production ORCA readiness, S3/object-storage readiness, or final release readiness.
