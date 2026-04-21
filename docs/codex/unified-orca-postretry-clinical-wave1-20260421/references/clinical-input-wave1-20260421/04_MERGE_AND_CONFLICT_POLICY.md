# 04. Merge and conflict policy

## Main agent responsibilities

- CWP-01 gate を確認する。
- sub-agent を個別 worktree で起動する。
- sub-agent 報告を読み、scope / forbidden action / evidence claim を確認する。
- merge 順を統括する。
- conflict を解消する。
- targeted regression commands を実行する。
- final report を作る。

## Conflict risk matrix

| area | likely conflicts | handling |
|---|---|---|
| `DiagnosisEditPanel.tsx` | CWP-05 only | CWP-05 内で完結させる。DADS 変更は最小限。 |
| `LocalDiagnosisResource.java` / `AbstractResource.java` | CWP-05 date parsing | date contract を明示し、silent drop を避ける。 |
| `SoapNotePanel.tsx` / `ChartsPage.tsx` | CWP-02 only, but shared chart state | server reload と sessionStorage fallback の優先順位を明示。 |
| `OrderBundleEditPanel.tsx` / `orderBundleApi.ts` | CWP-04 and maybe CWP-03 | CWP-04 を先に merge。CWP-03 は prescription editor を優先。 |
| `PrescriptionOrderEditorPanel.tsx` | CWP-03 only | generic order helpers を無理に共有しすぎない。 |
| `DocumentCreatePanel.tsx` | CWP-06 only | CWP-06 を後段 merge。notice/error wording conflict に注意。 |
| DADS helpers | all packages may add assertions | shared helper は最後に統合。大規模 UI redesign は Wave 2。 |

## Merge pre-check for each branch

```bash
git status --short
git diff --check
# run the sub-agent targeted tests exactly as reported
```

## Post-merge regression suggestion

Wave 1 全体で、少なくとも次の targeted commands を候補にする。

```bash
# server-modernized clinical local persistence subset
mvn -f pom.server-modernized.xml -pl server-modernized -am \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest='*KarteDocument*Test,*KarteRevision*Test,*LocalDiagnosisResourceTest,*LocalChartSubjectiveResourceTest,*LocalOrderBundleResourceTest,*LocalPrescriptionOrderResourceTest,*DocumentIntegrityServiceTest' test

# web-client targeted clinical input tests; exact package manager/script names must be checked in repo
cd web-client
npm test -- --run DiagnosisEditPanel diseaseApi SoapNotePanel prescriptionOrder orderBundle documentCreatePanel PatientSummaryPanel
```

Use actual repository scripts if the above pattern is not supported. Do not claim tests that were not executed.

## Final merge decision

- `PASS`: all required targeted tests pass and scope boundaries are clean.
- `PARTIAL`: some targeted areas pass, but documented blocked items remain.
- `BLOCKED`: core acceptance not met or forbidden action occurred.
