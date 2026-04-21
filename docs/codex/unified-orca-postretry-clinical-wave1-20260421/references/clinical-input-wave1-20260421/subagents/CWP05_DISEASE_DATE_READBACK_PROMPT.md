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
