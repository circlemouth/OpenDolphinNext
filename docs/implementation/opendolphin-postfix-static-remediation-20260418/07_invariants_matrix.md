# 07 invariants matrix

## Critical / High invariants

| id | invariant | must not regress | evidence required |
|---|---|---|---|
| C7-I1 | Unselected medical information run omits `medicalInformation` / `Medical_Information` field entirely. | Empty string, null, false, object, array, or any key presence cannot pass. | helper tests + QA script behavior + docs wording |
| C7-I2 | Target mutation request capture is mandatory. | `checkedRequests=0` cannot be success. | helper test + script error propagation |
| C5-I1 | Patient import full success requires business success, no errors, no skipped, count consistency, canonical readback. | `skippedCount>0` or count mismatch cannot show success toast/audit success. | API tests + UI warning tests |
| C3-I1 | Current row ORCA send/invoice signal must be row-local. | patientId/latest fallback cannot produce positive signal. | actual component + helper integration tests |
| C3-I2 | Print invoice prefill must be row-local. | latest income from another encounter cannot prefill invoice. | print hook tests |
| C2-I1 | Userinfo URL is rejected before persistence/use. | userinfo must not be normalized silently or returned in admin view. | config/admin tests |
| C2-I2 | Raw target material does not leak in failure surfaces. | URL/userinfo/host/secret path absent from rendered log/response/audit/details. | rendered negative tests |
| C1-I1 | `default` sentinel literal is rejected consistently. | config/admin cannot save/default a facility named sentinel if transport rejects it. | config/admin/transport/readiness tests |
| RT-I1 | Server public ORCA route taxonomy remains official/master only. | queue/pushevent not registered as public route. | server inventory tests |
| RT-I2 | Client fail-close sentinel and mock/test route strings are explicitly classified. | guard success message cannot contradict allowlist. | web guard test/log + docs |

## Medium invariants

| id | invariant | must not regress | evidence required |
|---|---|---|---|
| C6-I1 | ORCA収納情報 important labels are visible and outside closed details. | DOM presence only is not enough. | `toBeVisible()` unit/e2e assertions |
| C6-I2 | OrcaSummary remains support panel; primary CTA ownership stays outside summary. | Do not introduce competing primary CTA. | source review + UI contract note |
| TNEG-I1 | Detail log and admin save failure payload/details are sanitized. | Summary log coverage alone is insufficient. | rendered negative tests |
| DOC-I1 | Old PASS / already closed docs are not current truth. | Worker report claim cannot be accepted as truth. | docs cleanup review |
| TEST-I1 | Test run claims need log evidence. | A command written in report is not accepted unless rerun/log confirmed. | test evidence table |

## Preserved areas to guard

| area | preserved invariant |
|---|---|
| reception official flow | local/official search separation, WholeName server outbound, InOut/Medical_Information omission, handoff fail-close, acceptmodv2 21/60 context handling |
| administration / manageusers / connection wording | connection success wording separated from permission/admin wording; testedScope/push save/connection test separated; pushTenantId alone rejected |
| C4 OrcaSummary direction | Workflow / Transmission / ORCA収納情報 outside details; correction/setting visible direction preserved |
| send success != paid | send success alone never equals paid; paid only with income paid invoice match |
| R-OBS-01 | `clientAuthConfigured` truth comes from server config and remains visible in readiness/audit without raw target leakage |
