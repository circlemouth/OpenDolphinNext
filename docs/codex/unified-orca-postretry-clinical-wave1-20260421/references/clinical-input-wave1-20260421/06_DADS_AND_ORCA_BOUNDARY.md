# 06. DADS and ORCA boundary

## DADS basis

Wave 1 may use only the following DADS basis:

- important information not hidden
- label/support text/error text
- placeholder not used as substitute
- disabled avoided or reason/enabling condition nearby
- one primary action per screen/context
- button order and hierarchy
- date input guidance
- error text concrete and static
- accessibility/focus/contrast if source supports checking

## DADS application by package

| package | DADS focus |
|---|---|
| CWP-05 | disease date input guidance, concrete validation error, important disease info not hidden |
| CWP-02 | SOAP textareas visible labels/support text; disabled save reason; static error text |
| CWP-03 | prescription fields visible before save; primary action clarity; comment boundary text |
| CWP-04 | local-only vs ORCA-sendable distinction visible; validation error concrete |
| CWP-06 | document two-phase failure notice concrete; retry condition visible; placeholder not used as only guidance |

DADS 専用の大規模 UI 改修は Wave 2 の CWP-08/09 に分離する。Wave 1 では、対象機能のテスト追加に必要な最小 UI contract のみ扱う。

## ORCA boundary

Local chart/document persistence:

- SOAP local save: `/api/local/charts/subjectives`
- prescription local save: `/api/local/prescription-orders`
- generic order local save: `/api/local/order/bundles`
- disease local save: `/api/local/diagnoses`
- document/free document local save: `/karte/document`, `/odletter/letter`, free document APIs

Static ORCA preparation:

- medicalmodv2 payload preparation / static snapshots
- diseasev3 DTO / stub / route references
- subjectivesv2 enum / stub references

Future ORCA gate only:

- live medicalmodv2 mutation
- live diseasev3 mutation
- live subjectivesv2 mutation
- official ORCA spec compatibility for classCode/bodyPart/comment/material/outcome/date semantics

## Forbidden claim examples

```text
Do not write: ORCA registration verified.
Do write: local prescription persistence verified; ORCA medicalmodv2 live mutation not verified.

Do not write: diseasev3 supported.
Do write: disease local persistence verified; diseasev3 official mutation requires future ORCA official spec/live gate.

Do not write: SOAP subjectivesv2 saved.
Do write: SOAP local chart subjectives saved; ORCA subjectivesv2 not called in this package.
```
