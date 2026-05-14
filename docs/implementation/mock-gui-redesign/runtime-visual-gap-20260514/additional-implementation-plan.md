# Additional Implementation Plan

RUN_ID: `20260514T020603Z`

## Priority 0: Live Charts Send Path

- Done in follow-up `20260514T031538Z`: `qa-fullflow-weborca.mjs` accepts the current canonical Reception row handoff and preserves duplicate-accept prevention.
- Done in follow-up `20260514T031538Z`: embedded Charts header shows the primary encounter CTA, including `診察終了して会計へ送信` when the encounter is in a finishable context.
- Remaining: fullflow later steps still need stabilization after order save. Current observed blocker is prescription fallback/send handling, not the Reception-to-Charts handoff.
- Remaining: accounting send may still be blocked by Trial data / ORCA business rules. Do not mark it accepted unless the response is classified as business accepted with completion evidence.

## Priority 1: M01 First-View Density

- Reduce visual pressure from `暫定参照 / ORCA正本確認が必要` when the patient can still be safely reviewed.
- Keep send blocking and reason/解除条件 visible near affected CTA.
- Ensure patient identity and SOAP remain visible above the fold at desktop width.

## Priority 2: Scenario Coverage For Modal And Drawer States

- Add PHI-safe browser scenario data for:
  - M04 Do-copy source/target comparison.
  - M06 dirty SOAP patient switch confirmation.
  - M08 concurrent edit conflict.
  - M09/M10 live RP single/multi-drug save.
  - M11 prescription safety warnings.
  - M17 report preview.
- Prefer existing server/local APIs and volatile state. Do not add patient context to URL or browser storage.

## Priority 3: ORCA Trial Endpoint Payloads

- For `instruction-charge`, `base-charge`, `injection`, `surgery`, and `radiology`, current prepared payloads reached the safe wrapper but were `transportRejected`.
- Do not relabel them as accepted. Prepare new endpoint-specific candidates only after no-live validation and duplicate checkpoint review.
- Do not repeat prior accepted/rejected duplicate-live checkpoint identities.

## Done Conditions For Follow-up

- Codex browser can open a Trial accepted Charts page and display the normal close-and-send flow when prerequisites are satisfied.
- fullflow can complete or produce a precise non-success classification after order save attempts.
- M01〜M18 matrix has either `verified`, `blocked with root cause`, or `not applicable to live Trial` for every row.
- All evidence remains sanitized.
