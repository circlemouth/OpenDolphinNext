# Sub-agent C prompt: CWP-03 prescription full local persistence

```text
あなたは CWP-03 prescription full local persistence 担当 sub-agent です。
モデルは gpt-5.4 high を使う。
必ず個別 worktree `../odn-cwp03-prescription-local-flow` で作業する。

目的:
処方オーダーを local chart persistence として、save → reload → edit → delete → previous chart copy までテストで固定する。

背景:
処方 editor と `/api/local/prescription-orders` は実装済みだが、full local persistence e2e/component coverage が不足している。
local save と ORCA medicalmodv2 registration は別物であり、local save 成功を live ORCA 成功と書いてはいけない。

Scope:
- RP 追加、薬剤、用量、単位、用法、日数/回数
- RP claim comment、drug claim comment、doctor comment
- save → reload/readback
- edit → reload/readback
- delete
- previous chart copy
- static interaction check failure: warning and local save behavior
- local save が `/api/orca/official/chart-support/medical-mod-v2` を呼ばない boundary assertion

Likely files:
- web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx
- web-client/src/features/charts/prescriptionOrderApi.ts
- web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts
- web-client/src/features/charts/__tests__/prescriptionOrderEditorPanel.test.tsx
- web-client/src/features/charts/__tests__/prescriptionOrderEditorPanel.local-only.test.tsx
- web-client/src/features/charts/__tests__/prescriptionOrderOrcaSupport.test.tsx
- tests/charts/e2e-prescriptionv2-flow.spec.ts
- tests/charts/e2e-order-save-send-flow.spec.ts
- docs/codex/clinical-input-cwp03-prescription-local-flow-YYYYMMDD/

Implementation policy:
- まず component/API tests を優先する。
- Playwright を追加する場合は MSW で local persistence のみを検証し、live ORCA は絶対に呼ばない。
- DADS 上、薬剤名・用量・単位・用法・日数・コメントは保存前に見えること。placeholder だけを案内にしない。
- primary action が乱立する場合は、少なくとも test/document で context を明示する。大規模 UI 改修は CWP-08 へ送る。

Forbidden:
- 外部 web
- live ORCA mutation
- Phase 3 / Phase 4 / fullflow
- medicalmodv2 live success claim
- raw trace/HAR/video/screenshot artifact

Acceptance:
- 処方 full local flow が test で固定される。
- local save/readback/edit/delete/copy で RP/drug/usage/days/comments が保持される。
- doctor comment local-only と claim comment send-target の境界が test で明示される。
- local prescription save が ORCA transport / official medicalmodv2 endpoint を呼ばない。
- targeted tests pass。
- final report に ORCA boundary を明記する。
```
