# M01-M18 Mock Gap Matrix

RUN_ID: `20260514T020603Z`

| Mock | Expected | Runtime Result | Gap / Follow-up |
| --- | --- | --- | --- |
| M01 | 3-column chart workspace, patient header, safety tags, SOAP, left panels, daily orders, right dock | Core markers visible. Trial `00001` showed strong ORCA official recheck guard; Trial `00002` opened without that guard. | Header/guard density needs tuning so safety guard does not dominate the workspace when Charts is otherwise available. |
| M02 | Right drawer candidate sources, search, input form, apply button | Prescription drawer opened; RP marker visible. | Need full visual pass for candidate source tabs and apply CTA after order data is available. |
| M03 | Diagnosis detail, required fields, uncoded warning, ORCA send plan | Diagnosis detail opened; `未コード化` and `ORCA送信予定` visible. | Confirm focus trap and primary CTA with keyboard pass. |
| M04 | Do-copy preview, source/target compare, undo | Do-copy button visible, but comparison state was not reliably surfaced in the live Trial pass. | Needs seeded past note or controlled previous-visit state. |
| M05 | Document bottom dock, history, form, image attach, save/preview/PDF | Document/image markers visible. | Need active document creation scenario and output preview verification. |
| M06 | Patient/reception selector with unsaved-switch guard | Reception list and Charts opening worked. Dirty patient-switch guard not induced in live run. | Needs dirty SOAP state plus patient switch scenario. |
| M07 | Close-and-send checklist, report options, ORCA send CTA | Normal close-and-send CTA was not visible in Trial `00002` Charts; `00001` send was guarded. | Primary blocker for live UI accounting send from Charts. |
| M08 | Concurrent edit conflict comparison | Not induced. | Needs two-session lock/conflict scenario or safe controlled fixture. |
| M09 | Single-drug RP input | RP marker visible in prescription drawer. | Need actual single-drug RP save path in live UI. |
| M10 | Multi-drug single RP with common usage | RP marker visible, but multi-drug scenario not completed in live UI. | Need live UI order editor save completion or component-level controlled pass. |
| M11 | Safety check warning categories and reason | Safety-check wording not fully reached in live UI. | Need prescription safety modal scenario. |
| M12 | ORCA send result success/failure/partial/retry | Close-and-send result UI not reached. Phase4 wrapper returned transport rejections. | Need Charts send CTA blocker fix first; rejection/UNKNOWN UI must remain visible. |
| M13 | ORCA official diff | ORCA正本 marker visible. | Need explicit diff rows after ORCA re-fetch. |
| M14 | Revision history/signature | 版履歴 and 署名 markers visible. | Need full timeline and signature confirmation pass. |
| M15 | Image upload bottom dock | Image marker visible. | Need upload/camera/scan interaction with PHI-safe evidence. |
| M16 | Set/stamp apply preview | Set/stamp marker visible. | Need apply-preview modal and before/after comparison pass. |
| M17 | Report selection/preview | Print/export and document markers visible. | Need report preview and PDF/print output status. |
| M18 | Post billing sent lock and accounting navigation | Not reached because close-and-send did not complete. | Requires M07/M12 send path unblock; keep accounting sent separate from billed. |

## Overall Gap Classification

- `Implemented/visible`: M01 partial, M02 partial, M03 partial, M05 partial, M13 partial, M14 partial, M15 partial, M16 partial, M17 partial.
- `Needs scenario data`: M04, M06, M08, M09, M10, M11.
- `Blocked by live send path`: M07, M12, M18.
