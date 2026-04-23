# Functional Claims Boundary

RUN_ID: `20260422T134401Z`

| Area | Allowed claim | Prohibited claim | Evidence | Missing evidence | Next action |
|---|---|---|---|---|---|
| Electronic chart order entry and prescription input fully verified? | Clinical Wave 1 local/server/component/static verification exists for selected chart/order/prescription workflows. Artifact-free browser local persistence evidence now exists for selected RWO-02 through RWO-05 workflows. | Fully verified end-to-end; release-ready; full UI click-through/fullflow/live ORCA verified. | WO-3 CWP-01; WO-4 CWP-03/04; WO-3/4 final reports; RUN_ID `20260423T010054Z`, `20260423T023456Z`, and `20260423T030122Z` safe browser evidence. | Full UI click-through browser coverage, fullflow, live Trial medicalmodv2. Production ORCA is out of scope. | RWO-02-RWO-06. |
| ORCA-backed prescription registration verified? | Prescription local flow and ORCA boundary tests exist. | ORCA-backed prescription registration verified. | CWP-03 says no live medicalmodv2 claim. | Live Trial medicalmodv2 with business criteria. Production evidence is not required for this roadmap and must not be claimed. | RWO-03 then RWO-06. |
| Generic order ORCA registration verified? | Generic order local matrix evidence exists. | Generic order ORCA registration verified. | CWP-04 says no live medicalmodv2 claim. | Live trial medicalmodv2 per order class and fullflow evidence. | RWO-04 then RWO-06/RWO-07. |
| Disease ORCA registration verified? | Disease local persistence/date/readback verified. | Live diseasev3 registration verified. | CWP-05 says live diseasev3 not claimed. | Owner-approved live diseasev3 trial evidence. | RWO-05 then RWO-06. |
| SOAP ORCA registration verified? | SOAP local save/reload and dirty-state behavior verified. | Live subjectivesv2 registration verified. | CWP-02 says SOAP local save does not call ORCA subjectivesv2. | Owner-approved subjectivesv2 live plan/evidence. | RWO-05 then RWO-06. |
| Fullflow verified? | Fullflow is documented as required future work. | Fullflow verified. | WO-3/4/5/6/7/8 consistently mark fullflow `not_run`. | Safe fullflow execution evidence. | RWO-08. |
| S3/object-storage readiness? | S3-required tasks are out of scope and skipped. | Attachment storage ready, PHR export storage ready, S3 persistence ready, or object-storage deployment ready. | Current roadmap scope. | None required for this roadmap; separate owner-approved S3 plan would be needed. | RWO-09-RWO-11. |
| Trial-backed release readiness? | Repo-local roadmap, local/static evidence, partial artifact-free browser evidence, RWO-09 non-S3 static/CI evidence, and owner standing approval to continue Trial-backed non-S3 roadmap work are consolidated. | Production-ready, production ORCA ready, S3/object-storage ready, final Trial-backed release GO, or production release-ready. | Current roadmap scope and manager/release docs; RUN_ID `20260423T030122Z` RWO-09 static/CI evidence; RUN_ID `20260423T034854Z` RWO-10/RWO-11 non-claim marker; RUN_ID `20260423T035517Z` owner standing approval marker. | Trial-scope non-S3 runtime readiness, final owner GO/NO-GO, full UI browser/fullflow evidence, and live Trial expansion through an approved non-S3 path. Production ORCA is `not_applicable_trial_only`; S3/object-storage is `not_applicable_out_of_scope`. | RWO-09-RWO-11. |

## Explicit Answers

- Can we claim electronic chart order entry and prescription input are fully verified? No.
- Can we claim ORCA-backed prescription registration is verified? No.
- Can we claim generic order ORCA registration is verified? No.
- Can we claim disease ORCA registration is verified? No.
- Can we claim SOAP ORCA registration is verified? No.
- Can we claim fullflow is verified? No.
- Can we claim Trial-backed release readiness? Not yet.
- Is owner standing approval present for continuing Trial-backed non-S3 roadmap work? Yes.
- Can we claim production ORCA readiness or production release readiness from this roadmap? No.
- Can we claim S3/object-storage readiness from this roadmap? No.

## RWO-10 / RWO-11 Marker

RUN_ID `20260423T034854Z` records production ORCA readiness as `not_applicable_trial_only` for this automation roadmap. This is a non-claim, not a successful production readiness result.

The current final release decision remains `not_ready`: owner standing approval to proceed is present and RWO-09 static/CI evidence improved, but full UI click-through browser coverage, fullflow, live Trial expansion through an approved non-S3 runtime path, package regeneration when the accepted ref changes, and final owner GO/NO-GO are still missing.
