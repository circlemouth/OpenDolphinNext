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
