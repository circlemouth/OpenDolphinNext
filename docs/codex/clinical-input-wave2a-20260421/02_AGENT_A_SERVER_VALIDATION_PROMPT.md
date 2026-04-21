あなたは Wave 2A Agent A です。担当は server validation と parser logging hardening です。

モデル:
- gpt 5.4 high

作業場所:
- 必ず coordinator とは別の個別 worktree で作業すること
- 推奨 branch: codex/wave2a-agent-a-server-validation

目的:
Wave 1 blocker のうち server-side clinical data integrity に直結する項目を修正する。

担当範囲:
1. LocalDiagnosisResource / related validation
   - yyyy-MM-dd を受ける UI と整合する date handling にするか、fail-closed で 400 にする
   - invalid date を null 永続化しない
   - endDate before startDate を reject
   - unknown outcome を reject するか、repo 内根拠のある allowlist で制限
2. LocalChartSubjectiveResource performDate
   - invalid performDate current-date fallback を廃止
   - fail-closed の validation と safe error を返す
3. parser logging
   - invalid input で stack trace を通常ログに露出しない
   - safe, bounded, clinically useful log + client error response に整理
4. tests
   - Wave 1 characterization/blocker tests を desired behavior に更新
   - server tests を追加/更新する

優先ファイル候補:
- server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java
- server-modernized/src/main/java/open/dolphin/rest/orca/LocalChartSubjectiveResource.java
- server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java
- server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/LocalChartSubjectiveResourceTest.java

禁止:
- ORCA live mutation
- ORCA official spec lookup
- unrelated refactor
- legacy client/server changes
- order set changes

期待する完了条件:
- invalid diagnosis/SOAP dates are fail-closed
- no silent null persistence for date parse failures
- chronology validation exists
- unknown outcome no longer persists silently
- invalid-input parser stack traces are removed from ordinary path
- targeted server tests pass

報告に必ず書くこと:
- 採用した date contract
- outcome allowlist の根拠
- backward-compat ではなく current repo contract を優先した理由
- 残った ambiguity
