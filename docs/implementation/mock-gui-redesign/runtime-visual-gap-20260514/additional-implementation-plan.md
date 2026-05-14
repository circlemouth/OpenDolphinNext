# Additional Implementation Plan

RUN_ID: `20260514T020603Z`

## Priority 0: Live Charts Send Path

- Done in follow-up `20260514T031538Z`: `qa-fullflow-weborca.mjs` accepts the current canonical Reception row handoff and preserves duplicate-accept prevention.
- Done in follow-up `20260514T031538Z`: embedded Charts header shows the primary encounter CTA, including `診察終了して会計へ送信` when the encounter is in a finishable context.
- Remaining: fullflow later steps still need stabilization after order save. Current observed blocker is prescription fallback/send handling, not the Reception-to-Charts handoff.
- Remaining: accounting send may still be blocked by Trial data / ORCA business rules. Do not mark it accepted unless the response is classified as business accepted with completion evidence.

## Priority 1: M01 First-View Density

- Done in follow-up `20260514T040844Z`: `ChartsPatientSummaryBar` の `暫定参照 / ORCA正本確認が必要` alert を compact inline 表示へ調整した。alert は初期表示、`role=alert`、details 外表示を維持する。
- Done in follow-up `20260514T040844Z`: send / finish blocking と解除条件は `ChartsActionBar` の近傍 guard note に残し、compact alert は blocker 理由の代替にしない。
- Remaining verification: browser 1280x800 で患者識別、来院文脈、embedded CTA、SOAP 先頭が同時に見えることを sanitized DOM / visual marker で確認する。

## Priority 2: Scenario Coverage For Modal And Drawer States

- Add PHI-safe browser scenario data for:
  - M04 Do-copy source/target comparison.
  - M06 dirty SOAP patient switch confirmation.
  - M08 concurrent edit conflict.
  - M09/M10 live RP single/multi-drug save.
  - M11 prescription safety warnings.
  - M17 report preview.
- Prefer existing server/local APIs and volatile state. Do not add patient context to URL or browser storage.

## Priority 2A: Fullflow Close-And-Send Classification

- Done in follow-up `20260514T040844Z`: `qa-fullflow-weborca.mjs` は通常 UI の `診察終了して会計へ送信` 確認 modal を確定し、`/api/local/encounters/{encounterKey}/close-and-send-to-billing` を待つ。
- Done in follow-up `20260514T040844Z`: low-level `ORCA 送信` dialog / debug fallback を fullflow の成功条件から外した。
- Done in follow-up `20260514T040844Z`: summary / blocker summary に sanitized `closeAndSendResult` を追加し、route template、HTTP status class、operationStatus/state、needsUserReview、apiResult、rawSensitiveFieldsExcluded を記録する。
- Trial の business reject / capability limitation は `trial-business-or-capability-blocker` として分類し、live business accepted 未達だけで repo defect にしない。

## Priority 3: ORCA Trial Endpoint Payloads

- For `instruction-charge`, `base-charge`, `injection`, `surgery`, and `radiology`, current prepared payloads reached the safe wrapper but were `transportRejected`.
- Do not relabel them as accepted. Prepare new endpoint-specific candidates only after no-live validation and duplicate checkpoint review.
- Do not repeat prior accepted/rejected duplicate-live checkpoint identities.

## Done Conditions For Follow-up

- Codex browser can open a Trial accepted Charts page and display the normal close-and-send flow when prerequisites are satisfied.
- fullflow can complete or produce a precise non-success classification after order save attempts. ORCA Trial limitation / business reject is acceptable only when the normal close-and-send route was reached or the UI guard reason is explicit.
- M01〜M18 matrix has either `verified`, `blocked with root cause`, or `not applicable to live Trial` for every row.
- All evidence remains sanitized.
