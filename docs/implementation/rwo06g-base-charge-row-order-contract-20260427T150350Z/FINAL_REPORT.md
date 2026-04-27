# RWO-06G base-charge row-order contract

RUN_ID: `20260427T150350Z`

No live ORCA Trial mutation was run. This run added a repo-local no-live contract for `baseChargeOrder` / Claim007 class `110` so the consultation fee row `111000110` must be the first row of the first `medicalInformation` set and must not be duplicated before any future live path.

## Result

| Item | Result |
|---|---|
| Work Order | `RWO-06G` |
| Task | `RWO-06G_BASE_CHARGE_ROW_ORDER_CONTRACT` |
| Payload | `web-client/qa/payloads/phase4/medicalmodv2_base_charge_trial_reachability_v2.json` |
| Payload SHA-256 | `4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a` |
| Duplicate-live checkpoint | `rwo06g:medicalmodv2:rwo06g-base-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a` |
| Live Trial ORCA | Not executed |
| Business success | Not applicable; no-live contract only |

## Contract Evidence

- `baseChargeOrder` / `110` must be the first `medicalInformation` set.
- The first row of the first set must be consultation fee code `111000110`.
- Consultation fee code `111000110` must appear exactly once.
- `includeInitialConsultation=true` is treated as duplicate-risk and fails closed for this packet.
- Request semantics remain create-only `Request_Number=01`, `classCode=01`; `02` / `03` / `04` are not accepted by this contract.

## Checks

| Check | Result |
|---|---|
| `npm run test:ci -- scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | PASS; 30 tests |
| `qa-phase4-safe-medicalmodv2.mjs --dry-run --workflow base-charge` | PASS; no live ORCA |
| Web guard pretest | PASS |

## Misuse Cases

| Misuse case | Control |
|---|---|
| Move `baseChargeOrder/110` after another order group. | Contract returns blockers and `liveTrialAction=not_run`. |
| Duplicate consultation fee code `111000110`. | Contract returns duplicate blocker before live. |
| Treat dry-run or HTTP/API placeholders as business success. | Evidence classifies dry-run as no-live only and `businessAccepted=false`. |

## Claim Boundary

Allowed claim: RWO-06G baseChargeOrder/110 row-order and duplicate consultation-fee no-live contract is locked for the current v2 payload.

Not claimed: baseChargeOrder Trial business acceptance, first-visit compatibility proof, Request_Number `02` / `03` / `04` success, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.

## Next Action

Continue to `DISEASEV3_READONLY_BASELINE` when safe runtime is available; otherwise use `ACCEPTMODV2_RN02_03_04_TARGET_INVENTORY` or independent no-live stop-gate work.
