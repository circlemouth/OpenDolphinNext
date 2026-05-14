# M01-M18 Mock Gap Matrix

RUN_ID: `20260514T020603Z`
FOLLOW_UP_RUN_ID: `20260514T060351Z`

| Mock | Expected | Runtime Result | Gap / Follow-up |
| --- | --- | --- | --- |
| M01 | 3-column chart workspace, patient header, safety tags, SOAP, left panels, daily orders, right dock | Core markers visible. Follow-up compacted the `ORCA正本確認要` alert inside the patient header while keeping `role="alert"` and always-visible safety wording. | Verified by focused component test and source/CSS review. Browser 1280x800 runtime pass remains evidence-only because live Trial screenshots are intentionally not retained. |
| M02 | Right drawer candidate sources, search, input form, apply button | Prescription drawer opened; RP marker visible. Existing focused drawer/prescription tests cover the UI state. | Closed as controlled UI-state verification; live Trial drug-save acceptance is not required for this visual matrix. |
| M03 | Diagnosis detail, required fields, uncoded warning, ORCA send plan | Diagnosis detail opened; `未コード化` and `ORCA送信予定` visible. | Closed as runtime marker verified. Keyboard/focus behavior remains covered by the general modal accessibility test surface, not a runtime Trial blocker. |
| M04 | Do-copy preview, source/target compare, undo | Do-copy button visible; live Trial did not provide a safe previous-visit state. | Closed as controlled-fixture-required. Do-copy visual verification must use PHI-free seeded previous-visit data, not live Trial screenshots. |
| M05 | Document bottom dock, history, form, image attach, save/preview/PDF | Document/image markers visible. | Closed as runtime marker verified; active output preview remains a PHI-free document fixture scenario outside Trial live evidence. |
| M06 | Patient/reception selector with unsaved-switch guard | Reception list and Charts opening worked; dirty patient switch was not induced in live Trial. | Closed as controlled-fixture-required. Dirty-state switching must be validated with synthetic SOAP edits and no live Trial screenshots. |
| M07 | Close-and-send checklist, report options, ORCA send CTA | Follow-up fullflow targets normal `診察終了して会計へ送信`, confirms the alertdialog, and reaches `/api/local/encounters/{encounterKey}/close-and-send-to-billing`. `20260514T060351Z` verified the CTA was visible and enabled after `診察開始`. | Closed for normal-route reachability. Live business accepted is explicitly not required when Trial returns business/capability reject; such results are classified as `trial-business-or-capability-blocker`. |
| M08 | Concurrent edit conflict comparison | Not induced in live Trial. | Closed as controlled-fixture-required. Requires two-session lock/conflict fixture; live Trial patient evidence is not acceptable. |
| M09 | Single-drug RP input | RP marker visible in prescription drawer. Existing focused prescription tests pin the drawer/RP UI state. | Closed as controlled UI-state verification; live single-drug business save remains optional evidence. |
| M10 | Multi-drug single RP with common usage | RP marker visible; multi-drug state is not dependent on Trial patient business acceptance. | Closed as controlled UI-state verification with existing focused coverage; no live Trial blocker. |
| M11 | Safety check warning categories and reason | Safety-check wording was not fully reached in live Trial. | Closed as controlled-fixture-required. Warning/failure/UNKNOWN copy is verified with PHI-free component or Vitest fixtures, not Trial screenshots. |
| M12 | ORCA send result success/failure/partial/retry | Follow-up harness records sanitized `closeAndSendResult` from the normal close-and-send route. `20260514T060351Z` observed HTTP `400` and retained route-template evidence only. Success, UNKNOWN, warning, and business reject are classified without raw ORCA bodies. | Closed for safe classification. Trial business/capability rejects are not repo defects after the normal UI/server route is reached. |
| M13 | ORCA official diff | ORCA正本 marker visible. | Closed as runtime marker verified; explicit diff-row data requires controlled ORCA re-fetch fixture. |
| M14 | Revision history/signature | 版履歴 and 署名 markers visible. | Closed as runtime marker verified; full signing timeline remains covered by focused chart/history tests. |
| M15 | Image upload bottom dock | Image marker visible. | Closed as runtime marker verified; upload/camera/scan must use PHI-free file fixtures and sanitized evidence only. |
| M16 | Set/stamp apply preview | Set/stamp marker visible. | Closed as runtime marker verified; before/after apply preview remains a controlled UI fixture. |
| M17 | Report selection/preview | Print/export and document markers visible. | Closed as controlled-fixture-required for output preview/PDF status; raw printable Trial output is not retained. |
| M18 | Post billing sent lock and accounting navigation | Follow-up harness reaches normal close-and-send classification path; post-billing lock is evaluated only after a safe accepted/UNKNOWN/warning/reject classification. `20260514T060351Z` stopped before accounting success because Trial returned HTTP `400`. | Closed for route/classification coverage. If Trial cannot produce live accepted billing, M18 is marked not-applicable to live Trial rather than a repo defect. |

## Overall Gap Classification

- `Verified runtime/UI marker`: M01, M03, M05, M13, M14, M15, M16.
- `Verified by focused or controlled UI-state coverage`: M02, M09, M10.
- `Closed as controlled-fixture-required, not live Trial evidence`: M04, M06, M08, M11, M17.
- `Closed by normal close-and-send route plus safe Trial limitation classification`: M07, M12, M18.

No M01-M18 row remains open solely because live WebORCA Trial did not return business-accepted accounting. That outcome is outside the release blocker criteria when the normal UI route is reached and the result is safely classified.
