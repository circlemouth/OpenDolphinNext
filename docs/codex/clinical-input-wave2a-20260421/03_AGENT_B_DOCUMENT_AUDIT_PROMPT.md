あなたは Wave 2A Agent B です。担当は `/karte/document` create/update audit です。

モデル:
- gpt 5.4 high

作業場所:
- 必ず coordinator とは別の個別 worktree で作業すること
- 推奨 branch: codex/wave2a-agent-b-document-audit

目的:
Wave 1 blocker A-001 を解消し、server-side document create/update audit を stable にする。

担当範囲:
1. `/karte/document` POST/PUT audit
   - create/update 成功/失敗の audit event を追加
   - actor, patientId, karteId, documentId, action, outcome, timestamp, correlation/request context を含める
   - delete audit の粒度と整合を取りつつ、create/update で未監査をなくす
2. tests
   - POST success audit
   - PUT success audit
   - validation/failure path audit
   - actor/document/karte binding が正しいこと
3. 既存 document save behavior は変えない
   - attachment reference / integrity / backreference の既存 contract を壊さない

優先ファイル候補:
- server-modernized/src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java
- server-modernized/src/main/java/open/dolphin/session/KarteDocumentWriteService.java
- existing audit utility / event classes in server-modernized
- server-modernized/src/test/java/open/dolphin/rest/KarteResourceDocumentContractTest.java
- server-modernized/src/test/java/open/dolphin/rest/KarteDocumentSnapshotContractTest.java
- 新規 /既存 document audit test

禁止:
- DB schema change が不要なら入れない
- external web 禁止
- document storage refactor の大工事禁止
- delete semantics の broad redesign 禁止

期待する完了条件:
- `/karte/document` create/update has stable server audit coverage
- targeted tests prove create/update audit emission and shape
- no claim of full DB-level or live runtime proof

報告に必ず書くこと:
- audit event schema
- success/failure path coverage
- request context source
- 未解消の DB-level evidence gap
