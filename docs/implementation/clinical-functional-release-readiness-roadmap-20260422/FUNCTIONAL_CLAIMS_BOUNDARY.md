# Functional Claims Boundary

RUN_ID: `20260422T134401Z`

| Area | Allowed claim | Prohibited claim | Evidence | Missing evidence | Next action |
|---|---|---|---|---|---|
| Electronic chart order entry and prescription input fully verified? | Clinical Wave 1 local/server/component/static verification exists for selected chart/order/prescription workflows. | Fully verified end-to-end; release-ready; browser/fullflow/live ORCA verified. | WO-3 CWP-01; WO-4 CWP-03/04; WO-3/4 final reports. | Browser e2e, fullflow, live medicalmodv2, production ORCA. | RWO-02-RWO-06. |
| ORCA-backed prescription registration verified? | Prescription local flow and ORCA boundary tests exist. | ORCA-backed prescription registration verified. | CWP-03 says no live medicalmodv2 claim. | Live trial medicalmodv2 with business criteria; production evidence. | RWO-03 then RWO-06. |
| Generic order ORCA registration verified? | Generic order local matrix evidence exists. | Generic order ORCA registration verified. | CWP-04 says no live medicalmodv2 claim. | Live trial medicalmodv2 per order class and fullflow evidence. | RWO-04 then RWO-06/RWO-07. |
| Disease ORCA registration verified? | Disease local persistence/date/readback verified. | Live diseasev3 registration verified. | CWP-05 says live diseasev3 not claimed. | Owner-approved live diseasev3 trial evidence. | RWO-05 then RWO-06. |
| SOAP ORCA registration verified? | SOAP local save/reload and dirty-state behavior verified. | Live subjectivesv2 registration verified. | CWP-02 says SOAP local save does not call ORCA subjectivesv2. | Owner-approved subjectivesv2 live plan/evidence. | RWO-05 then RWO-06. |
| Fullflow verified? | Fullflow is documented as required future work. | Fullflow verified. | WO-3/4/5/6/7/8 consistently mark fullflow `not_run`. | Safe fullflow execution evidence. | RWO-08. |
| Production release readiness? | Repo-local roadmap and local/static evidence are consolidated. | Production-ready or release-ready. | Manager/release docs list external config/secrets/checks and gates. | Production ORCA, deployment config, security, owner sign-off, CI, browser/fullflow evidence. | RWO-09-RWO-11. |

## Explicit Answers

- Can we claim electronic chart order entry and prescription input are fully verified? No.
- Can we claim ORCA-backed prescription registration is verified? No.
- Can we claim generic order ORCA registration is verified? No.
- Can we claim disease ORCA registration is verified? No.
- Can we claim SOAP ORCA registration is verified? No.
- Can we claim fullflow is verified? No.
- Can we claim production release readiness? No.

