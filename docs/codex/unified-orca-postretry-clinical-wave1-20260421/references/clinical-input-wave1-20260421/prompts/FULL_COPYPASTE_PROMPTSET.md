# Full copypaste promptset for clinical input Wave 1

# 03. Main Codex prompt

```text
あなたは OpenDolphinNext clinical input coverage hardening の Codex メイン統括エージェントです。

目的:
CWP-01 の integration gate を確認し、通過後に CWP-05 / CWP-02 / CWP-03 / CWP-04 / CWP-06 を並列起動して統括する。

前提:
CWP-01: order-containing `/karte/document` save/readback/revision preservation tests は、ワーカー報告上 PASS。
報告された branch / commit / artifact:
- branch: codex/cwp01-karte-order-persistence
- commit: f6121aa23 docs: finalize CWP-01 order persistence evidence
- artifact: clinical-input-cwp01-karte-order-persistence-20260421.zip
- artifact SHA-256: bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2

CWP-01 reported verified:
- medOrder / treatmentOrder / radiologyOrder を含む canonical DocumentModel fixture
- KarteDocumentWriteService.addDocument equivalent server write path
- beanJson encode、module metadata、parent backreference、integrity seal
- detail readback
- revision snapshot、restore/revise clone path、diff digest、integrity tamper detection
- targeted Maven tests exit code 0, 24 tests, failures 0

ただし、以下は未検証のまま:
- Playwright / e2e / runtime browser success
- Phase 3 / Phase 4 / fullflow
- live ORCA mutation / ORCA medicalmodv2 success
- HTTP-level revise/restore authorization/history-group full flow
- ORCA claim field semantics
- ORCA 公式仕様との完全照合

最初に行うこと:
1. CWP-01 branch / commit / artifact SHA-256 / zip contents / targeted test summary をローカルで検証する。
2. 検証結果を sanitized command log として docs/codex に記録する。
3. CWP-01 を integration base branch に取り込む。
4. 以後の work package は CWP-01 統合後の base から個別 worktree を切る。

必須禁止事項:
- 外部 web を使わない。
- live ORCA mutation を行わない。
- Phase 3 / Phase 4 / fullflow を行わない。
- ORCA live success を claim しない。
- MSW / unit / local server test success を live ORCA success と書かない。
- 実行していない Playwright/e2e/runtime success を claim しない。
- raw HAR / trace / video / screenshot / credentials / secrets を成果物に含めない。
- build artifacts は成果物 zip に含めない。
- ORCA 公式仕様判断が必要な内容は “要 ORCA 公式仕様確認” として残す。

並列方針:
CWP-01 integration gate 後、以下の 5 work package を可能な限り並列に進める。
全 sub-agent は gpt-5.4 high で起動し、必ず個別 worktree で作業する。

推奨 worktree:
git worktree add ../odn-cwp05-disease-date-readback -b codex/cwp05-disease-date-readback
git worktree add ../odn-cwp02-soap-server-reload -b codex/cwp02-soap-server-reload
git worktree add ../odn-cwp03-prescription-local-flow -b codex/cwp03-prescription-local-flow
git worktree add ../odn-cwp04-generic-order-matrix -b codex/cwp04-generic-order-matrix
git worktree add ../odn-cwp06-document-two-phase-failure -b codex/cwp06-document-two-phase-failure

Sub-agent assignments:
- Sub-agent A: CWP-05 disease date/readback validation
- Sub-agent B: CWP-02 SOAP canonical server reload
- Sub-agent C: CWP-03 prescription full local persistence
- Sub-agent D: CWP-04 generic order bundle matrix + static ORCA boundary
- Sub-agent E: CWP-06 document attachment two-phase failure

Merge order:
1. CWP-01 verification / integration base
2. CWP-05 disease date/readback
3. CWP-02 SOAP server reload
4. CWP-04 generic order matrix
5. CWP-03 prescription local flow
6. CWP-06 document two-phase failure
7. shared docs/evidence updates
8. final targeted regression commands
9. final report

共通 acceptance:
- 追加テストは targeted command で実行し、exit code / test count / failures / skipped を記録する。
- git diff --check を通す。
- 可能なら既存 doc link checker を通す。
- 成果物 zip には source/test/docs/sanitized logs のみを含める。
- final report に verified / not verified / ORCA boundary / DADS boundary / next package を明記する。
- runtime browser / Playwright / live ORCA を実行していない場合は not verified と書く。

最終成果物:
- 各 branch の commit
- docs/codex/clinical-input-wave1-YYYYMMDD/ 以下の統合報告
- artifacts/codex/clinical-input-wave1-YYYYMMDD.zip
- artifact SHA-256
- targeted command summary
- not verified list
- next recommended CWP-07/CWP-08/CWP-09/CWP-10 plan
```


# Sub-agent A prompt: CWP-05 disease date/readback validation

```text
あなたは CWP-05 disease date/readback validation 担当 sub-agent です。
モデルは gpt-5.4 high を使う。
必ず個別 worktree `../odn-cwp05-disease-date-readback` で作業する。

目的:
病名入力 / disease / diagnosis の local persistence について、日付、転帰、疑い、主病名、delete/outcome、readback をテストで固定する。

背景:
前回レビューでは、UI が `yyyy-MM-dd` の date input を送る一方、server parse が日時形式前提に見えるため、startDate/endDate が silent drop される high-risk gap が指摘された。
mutation success 後の react-query invalidation はあるが、server から再取得して UI に反映された evidence が弱い。
ORCA disease master read と local diagnosis mutation は別物であり、diseasev3 live mutation success は claim しない。

Scope:
- LocalDiagnosisResource success create/update/delete integration tests
- date-only `yyyy-MM-dd` persistence regression
- invalid date / endDate before startDate / unknown outcome validation
- DiagnosisEditPanel mutation後 readback UI test
- ORCA mirror / candidate mutation boundary test
- suspected / principal save-readback-edit test
- acute flag unsupported contract, if applicable
- diseasev3 DTO/static route は必要最小限。live mutation は禁止。

Likely files:
- server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java
- server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java
- server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java
- web-client/src/features/charts/diseaseApi.ts
- web-client/src/features/charts/diseaseApi.test.ts
- web-client/src/features/charts/DiagnosisEditPanel.tsx
- web-client/src/features/charts/__tests__/DiagnosisEditPanel.test.tsx
- docs/codex/clinical-input-cwp05-disease-date-readback-YYYYMMDD/

Implementation policy:
- 後方互換性は考慮しなくてよい。過去DB遺産はないものとして、本番運用を見据えて安全な contract にする。
- ただし大規模 UI redesign はしない。
- DADS 上、日付入力には visible label、※必須/※任意、西暦例、placeholder 非依存、具体 error を入れる。
- disabled を使う場合は直近に理由と有効化条件を示す。
- ordinary validation error で `role="alert"` / assertive live region を新規に増やさない。

Forbidden:
- 外部 web
- live ORCA mutation
- Phase 3 / Phase 4 / fullflow
- ORCA diseasev3 success claim
- raw trace/HAR/video/screenshot artifact

Acceptance:
- `yyyy-MM-dd` startDate/endDate が保存・readback される、または invalid として 400/具体 error になる。
- invalid date、endDate before startDate、unknown outcome の仕様が test で固定される。
- create/update/delete/outcome close 後、UI が再取得結果を表示/消去する。
- ORCA mirror は edit/delete できない。
- candidate は明示 add のみで local に入る。
- suspected/principal が save → readback → edit dialog → badge まで保持される。
- targeted tests pass。
- final report に live ORCA not verified と明記する。
```


# Sub-agent B prompt: CWP-02 SOAP canonical server reload

```text
あなたは CWP-02 SOAP canonical server reload 担当 sub-agent です。
モデルは gpt-5.4 high を使う。
必ず個別 worktree `../odn-cwp02-soap-server-reload` で作業する。

目的:
SOAP / free text 入力について、local save だけでなく canonical server readback / reload の evidence を作る。

背景:
前回レビューでは、SoapNotePanel から `/api/local/charts/subjectives` への save と LocalChartSubjectiveResource の DocumentModel build は確認された。
一方、UI reload/readback は sessionStorage / local history 中心で、server-saved subjective から remount / reload / patient switch return で復元される evidence が弱い。
free は保存時に S へ mapping されるため、その仕様を readback でも明示する必要がある。

Scope:
- SOAP S/O/A/P/free save → server response → remount/reload readback
- free -> S mapping の表示仕様
- partial failure: 一部 section POST failure 時に dirty state が残り、成功済み section を二重投稿しない
- save failure keeps dirty
- invalid performDate behavior: 400 にするか、明示 fallback contract を test で固定
- SOAP save が ORCA subjectivesv2 を呼ばない boundary test

Likely files:
- web-client/src/features/charts/SoapNotePanel.tsx
- web-client/src/features/charts/soap/subjectiveChartApi.ts
- web-client/src/features/charts/__tests__/SoapNotePanel.test.tsx
- web-client/src/features/charts/__tests__/soapNoteDirtyState.test.tsx
- web-client/src/features/charts/__tests__/soapNoteAudit.test.tsx
- web-client/src/features/charts/pages/ChartsPage.tsx
- server-modernized/src/main/java/open/dolphin/rest/orca/LocalChartSubjectiveResource.java
- server-modernized/src/test/java/open/dolphin/rest/orca/LocalChartSubjectiveResourceTest.java
- docs/codex/clinical-input-cwp02-soap-server-reload-YYYYMMDD/

Implementation policy:
- 本番運用を見据えて、sessionStorage だけに依存する reload ではなく、server readback contract を明確化する。
- SOAP UI の labels/support text は DADS に反しないようにする。placeholder を案内の唯一の手段にしない。
- disabled button を新規に増やす場合、近接に理由と有効化条件を出す。

Forbidden:
- 外部 web
- live ORCA mutation
- ORCA subjectivesv2 mutation
- Phase 3 / Phase 4 / fullflow
- 実行していない e2e/runtime success claim

Acceptance:
- S/O/A/P/free を保存後、component remount または chart reload 相当で server response から表示が復元される。
- free -> S mapping が test 名と assertion で明確。
- partial failure で dirty state が期待通り残る。
- 成功済み section が二重投稿されない。
- SOAP local save が ORCA subjectivesv2 endpoint を呼ばないことを確認。
- targeted tests pass。
- final report に runtime browser / Playwright / live ORCA not verified を明記する。
```


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


# Sub-agent E prompt: CWP-06 document attachment two-phase failure

```text
あなたは CWP-06 document attachment two-phase failure 担当 sub-agent です。
モデルは gpt-5.4 high を使う。
必ず個別 worktree `../odn-cwp06-document-two-phase-failure` で作業する。

目的:
文書保存 / document / template / free document のうち、添付あり保存の two-phase failure をテストで固定する。
特に `/karte/document` success 後に `/odletter/letter` が failure になるケースの orphan reference / retry / user notice を扱う。

背景:
添付付き document save が `/karte/document` 成功後に `/odletter/letter` 保存へ進む二段階であり、後段失敗時の cleanup / compensation / retry idempotency が弱い。
CWP-01 で `/karte/document` order module persistence は補強済みだが、document attachment two-phase failure は別ギャップとして残る。

Scope:
- `/karte/document` returns docPk
- `/odletter/letter` returns 500
- UI notice: 何が失敗したか、再試行で何が起きるかを具体表示
- retry idempotency: duplicate reference を作らない、または明示 cleanup/compensation contract
- document template required/date/template unsupported 404
- free document save/readback/patient switch minimum coverage
- document delete semantics は必要最小限。大規模 delete chain は次 package に分離可。

Likely files:
- web-client/src/features/charts/DocumentCreatePanel.tsx
- web-client/src/features/charts/documentTemplates.ts
- web-client/src/features/charts/letterApi.ts
- web-client/src/features/charts/patientFreeDocumentApi.ts
- web-client/src/features/charts/PatientSummaryPanel.tsx
- web-client/src/features/charts/__tests__/documentCreatePanel.test.tsx
- web-client/src/features/charts/__tests__/PatientSummaryPanel.test.tsx
- server-modernized/src/test/java/open/dolphin/rest/KarteResourceDocumentContractTest.java
- server-modernized/src/test/java/open/dolphin/rest/KarteDocumentSnapshotContractTest.java
- docs/codex/clinical-input-cwp06-document-two-phase-failure-YYYYMMDD/

Implementation policy:
- user-facing error は具体的・静的に表示する。
- ordinary validation/failure のために `role="alert"` / assertive live region を新規に増やさない。
- placeholder を support text の代用にしない方向で、最低限の DADS 逸脱を悪化させない。
- retry/cleanup の実装方針を曖昧にしない。実装しない場合は unsupported/block として明確化する。

Forbidden:
- 外部 web
- live ORCA mutation
- Phase 3 / Phase 4 / fullflow
- raw HAR/trace/video/screenshot artifact
- failure を成功扱いにすること

Acceptance:
- two-phase failure test が pass。
- retry で duplicate reference を作らない、または cleanup/compensation の明示 contract が pass。
- user notice が具体的で、何を再試行するか分かる。
- referral 以外の template または unsupported template/date validation の coverage が増える。
- free document save/readback/patient switch の最低限 coverage がある。
- targeted tests pass。
```
