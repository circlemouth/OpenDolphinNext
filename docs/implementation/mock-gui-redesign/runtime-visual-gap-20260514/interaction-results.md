# Interaction Results

RUN_ID: `20260514T020603Z`

## Successful Interactions

- Login to `http://127.0.0.1:5173/`.
- Reception page opened without visible HTTP 500.
- WebORCA Trial candidate `00001` was accepted via `acceptmodv2`.
- Reception list showed accepted Trial rows.
- Charts opened from Reception `カルテ` button.
- Charts displayed core M01 shell markers:
  - patient identity
  - ORCA acquisition/source status
  - SOAP
  - prescription / injection / treatment / test / charge categories
  - document / image surfaces
  - ORCA original diff surface
  - revision history surface
- Prescription drawer opened and displayed RP-related markers.
- Diagnosis detail opened and displayed `未コード化` and `ORCA送信予定`.
- Revision / lower-dock related markers were visible.

## Blocked Or Incomplete Interactions

| Area | Result | Classification |
| --- | --- | --- |
| `runtime-ready-smoke` | failed because no runtime-ready reception entry was present before accept | test-data prerequisite, not ORCA connectivity failure |
| `qa-fullflow-weborca.mjs` first run | accepted `00002`, then stopped because canonical Charts handoff button did not appear | UI / harness handoff blocker |
| `qa-fullflow-weborca.mjs` rerun | stopped by disabled accept button: already accepted today | expected double-accept prevention |
| Charts `00001` | `暫定参照 / ORCA正本確認が必要` dominated first view and blocked send | expected safety guard, visual gap for M01 first-view density |
| Charts `00002` | Charts opened, but normal `診察終了して会計へ送信` CTA was not visible | functional/UI blocker for M07/M12/M18 |
| M08 conflict | no real concurrent edit conflict was induced against Trial live run | needs UI-only or controlled multi-session scenario |
| M12 failure/UNKNOWN modal | live send did not reach UI close-and-send result state | needs controlled failure scenario or backend fixture |

## Storage And URL Check

- Charts URL used query parameters for route context, but no new patient context was intentionally written to `localStorage` or `sessionStorage` during this verification.
- No raw ORCA credential, raw ORCA response, or certificate material was displayed in the checked UI markers.

## Browser Evidence Policy

- Screenshots were not persisted because live Trial patient identifiers were visible in Charts and Reception.
- Visual verification was recorded as sanitized DOM markers and result tables in this docset.

## Follow-up Fix Pass: `20260514T031538Z`

- `qa-fullflow-weborca.mjs` now accepts the current Reception row-level `カルテ` handoff instead of relying only on the obsolete modal-local `reception-patient-search-open-charts` button.
- Existing same-day受付 is classified as an existing-acceptance row handoff path; the disabled duplicate accept guard is not bypassed.
- Trial candidate `00005` confirmed the fixed path through `acceptmodv2 -> Reception row カルテ -> Charts` with no patient context query leak.
- Charts header now exposes the embedded primary encounter CTA:
  - `受付中` context: `診察開始`
  - `診療中` or later context: `診察終了して会計へ送信`
  - guarded close/send states still show nearby reason via `charts-actions-finish-guard`.
- Fullflow still did not complete accounting send. It reached Charts and saved a treatment order, then stalled/failed during later prescription/send handling in the QA harness. This remains a harness/runtime stability blocker, not an ORCA business accepted result.

## Follow-up Closure Pass: `20260514T040844Z`

- Charts patient summary now keeps the ORCA official recheck warning in the patient-header safety area as a compact alert, so the first view can preserve patient identity, visit context, primary CTA, and SOAP context while still failing closed for ORCA official uncertainty.
- The fullflow harness now uses the normal Charts action `診察終了して会計へ送信`, confirms `診察終了して会計へ送信の確認`, and waits for `/api/local/encounters/{encounterKey}/close-and-send-to-billing`.
- The harness no longer treats the low-level `ORCA 送信` control or debug fallback as a successful fullflow path.
- Close-and-send outcomes are recorded as sanitized `closeAndSendResult` data. Success, UNKNOWN, warning, business reject, and Trial capability limitation are separated; non-success outcomes are not shown or documented as accounting success.
- Live Trial screenshots, HAR, trace, video, raw network JSON, raw ORCA XML/JSON, and credentials remain excluded from retained evidence.
- Runtime-ready smoke passed with redacted evidence under `20260514T040844Z`.
- The final live fullflow reached Reception row handoff and Charts, saved the controlled treatment order, then classified close-and-send as `test-data-blocker / close_and_send_guard_blocked` because the normal `診察終了して会計へ送信` CTA was not visible in the existing Trial row state. This is a rooted blocker rather than a silent harness hang or false accounting success.

## CTA Reachability Fix Pass: `20260514T060351Z`

- Charts now reapplies the local encounter status override after appointment/claim refresh during `診察開始`, so a Trial row that starts from `受付中` transitions the embedded header CTA from `診察開始` to `診察終了して会計へ送信` without relying on Reception-side duplicate accept state.
- The fullflow harness records the normal CTA state after start. The retained button diagnostics show `#charts-action-finish`, label `診察終了して会計へ送信`, `disabled=false`, `ariaDisabled=false`, and `visible=true`.
- The harness clicked the normal finish CTA, confirmed the `診察終了して会計へ送信の確認` alertdialog, and observed `/api/local/encounters/{encounterKey}/close-and-send-to-billing`.
- The observed result was HTTP `400`, so it was classified as `trial-business-or-capability-blocker / trial_close_and_send_not_business_accepted:unknown`. This is not an accounting success and is not a repo defect under the Trial exception.
- Retained evidence uses sanitized route templates and redacted patient context only. No live Trial screenshot, HAR, trace, video, raw ORCA body, credential, or raw encounter URL is retained.
