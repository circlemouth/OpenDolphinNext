# Sub-agent D prompt: CWP-04 generic order bundle matrix + static ORCA boundary

```text
あなたは CWP-04 generic order bundle matrix + static ORCA boundary 担当 sub-agent です。
モデルは gpt-5.4 high を使う。
必ず個別 worktree `../odn-cwp04-generic-order-matrix` で作業する。

目的:
処方以外の order bundle、つまり injection / lab-test / radiology / treatment / surgery / other / material row / comment row について、local save/readback と static ORCA boundary を test で固定する。

背景:
CWP-01 で order-containing `/karte/document` persistence は補強されたため、今回は local order bundle API/UI と static send/block boundary に集中する。

Scope:
- injection: class allowlist、usage、drug row、material row、comment row、contraindication warning/block
- lab/test: `testOrder` 600系、specimen subtype、physiology/bacteria local save + send block
- radiology: bodyPart required/save/readback、bodyPart missing block
- treatment/surgery: material row persistence、copy/edit/delete
- otherOrder/local-only: save/readback + send block
- material: standalone material unsupported contract or material row preservation
- comments: structured claim comment、selection comment parameter block、doctor/local comment readback
- medicalmodv2 static payload snapshot
- `/api/local/order/bundles` が ORCA transport を呼ばない boundary assertion

Likely files:
- web-client/src/features/charts/OrderBundleEditPanel.tsx
- web-client/src/features/charts/orderBundleApi.ts
- web-client/src/features/charts/orderBundleContract.ts
- web-client/src/features/charts/orderCategoryRegistry.ts
- web-client/src/features/charts/orcaMedicalClassCatalog.ts
- web-client/src/features/charts/orderRpNormalization.ts
- web-client/src/features/charts/orcaClaimApi.ts
- web-client/src/features/charts/__tests__/orderBundle*.test.ts*
- web-client/src/features/charts/__tests__/otherOrderContract.test.ts
- server-modernized/src/test/java/open/dolphin/rest/orca/LocalOrderBundleResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/LocalOrderBundleResource600Test.java
- docs/codex/clinical-input-cwp04-generic-order-matrix-YYYYMMDD/

Implementation policy:
- Matrix fixtures は CWP-03 と衝突しない名前にする。
- Standalone material order を実装しない場合は unsupported contract として固定する。
- ORCA 公式仕様が必要な classCode/bodyPart/comment/material semantics は “要 ORCA 公式仕様確認” として残す。
- DADS 上、local-only / ORCA-sendable / import-only の違いは保存・送信前に見えるようにする。

Forbidden:
- 外部 web
- live ORCA mutation
- Phase 3 / Phase 4 / fullflow
- ORCA medicalmodv2 success claim
- unsupported order を黙って sendable にすること

Acceptance:
- injection/test/radiology/treatment/surgery/other の representative local save/readback matrix が pass。
- materialItems/commentItems/bodyPart/subtype が保持される。
- physiology/bacteria/other/local-only/unsupported comment/bodyPart は static send block として固定。
- static medicalmodv2 snapshot は live success claim ではないと report に明記。
- targeted tests pass。
```
