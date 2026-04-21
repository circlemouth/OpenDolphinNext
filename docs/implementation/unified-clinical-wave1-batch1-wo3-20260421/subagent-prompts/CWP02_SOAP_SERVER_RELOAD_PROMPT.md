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
