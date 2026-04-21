# 05. Acceptance matrix

| package | required tests/evidence | acceptance criteria | still not verified |
|---|---|---|---|
| CWP-01 | branch/commit/artifact/targeted Maven gate | order module in `/karte/document` save/readback/revision preserved | browser runtime, live ORCA, HTTP-level full revise/restore auth |
| CWP-05 | server + component/API tests | `yyyy-MM-dd` disease dates persist or reject with concrete 400; add/edit/delete/outcome readback works; ORCA mirror/candidate boundary fixed | live diseasev3 |
| CWP-02 | component + server tests | SOAP S/O/A/P/free save then server reload/remount restores display; partial failure dirty semantics fixed; no subjectivesv2 call | browser runtime, live subjectivesv2 |
| CWP-03 | component/API, optional MSW Playwright if actually run | prescription save/reload/edit/delete/copy preserves RP/drug/usage/days/comments; local save does not call ORCA medicalmodv2 | live medicalmodv2 |
| CWP-04 | server/component/static snapshot | injection/test/radiology/treatment/surgery/other local matrix; material/comment/bodyPart/subtype preserved; local-only/send-block snapshots fixed | official ORCA semantics |
| CWP-06 | component/API/server tests | `/karte/document` success + `/odletter/letter` failure behavior fixed; retry/idempotency or cleanup contract clear; user notice concrete | full document delete chain, browser runtime |

## Required final wording

Use this wording style:

```text
Verified by targeted local/server/component tests: ...
Not verified: Playwright/e2e runtime, live ORCA mutation, Phase 3/4, fullflow.
ORCA boundary: this package verifies local chart/document persistence or static payload preparation only.
```
