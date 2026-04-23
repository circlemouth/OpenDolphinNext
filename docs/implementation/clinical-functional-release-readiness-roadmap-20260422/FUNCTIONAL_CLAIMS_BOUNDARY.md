# Functional Claims Boundary

RUN_ID: `20260422T134401Z`

| Area | Allowed claim | Prohibited claim | Evidence | Missing evidence | Next action |
|---|---|---|---|---|---|
| Electronic chart order entry and prescription input fully verified? | Clinical Wave 1 local/server/component/static verification exists for selected chart/order/prescription workflows. Artifact-free browser local persistence evidence, one SOAP/disease UI clickthrough, and one scoped Trial `medicalmodv2` business acceptance now exist. | Fully verified end-to-end; release-ready; full prescription/order UI click-through/fullflow/broad live ORCA verified. | WO-3 CWP-01; WO-4 CWP-03/04; WO-3/4 final reports; RUN_ID `20260423T010054Z`, `20260423T023456Z`, `20260423T030122Z`, `20260423T050222Z`, and `20260423T150257Z`. | Prescription/order full UI click-through browser coverage, fullflow, and broader order-class Trial evidence. Production ORCA is out of scope. | RWO-09-RWO-11 plus safe browser/fullflow gates. |
| ORCA-backed prescription registration verified? | Prescription local flow, ORCA boundary tests, and one scoped Trial `medicalmodv2` business acceptance exist. | ORCA-backed prescription registration broadly verified or release-complete. | RUN_ID `20260423T150257Z` proves only target `00001`, Request_Number `01`, class `01` through safe wrapper. | Full UI/fullflow evidence and broader order/prescription scope. Production evidence is not required for this roadmap and must not be claimed. | RWO-09-RWO-11 plus safe fullflow when prerequisites are satisfied. |
| Generic order ORCA registration verified? | Generic order local matrix evidence and one scoped Trial `medicalmodv2` business acceptance exist. | Generic order ORCA registration broadly verified. | RUN_ID `20260423T150257Z` proves only one scoped Trial payload, not every generic order class. | Live trial medicalmodv2 per order class and fullflow evidence if the release claim requires it. | RWO-09-RWO-11; separate live expansion only with gates. |
| Disease ORCA registration verified? | Disease local persistence/date/readback verified; one no-live UI add path through `/api/local/diagnoses` is verified. | Live diseasev3 registration verified. | CWP-05 says live diseasev3 not claimed; RUN_ID `20260423T050222Z` is local-only browser evidence. | Owner-approved live diseasev3 trial evidence. | RWO-05 then RWO-06. |
| SOAP ORCA registration verified? | SOAP local save/reload and dirty-state behavior verified; one no-live UI S/O save path through `/api/local/charts/subjectives` is verified. | Live subjectivesv2 registration verified. | CWP-02 says SOAP local save does not call ORCA subjectivesv2; RUN_ID `20260423T050222Z` is local-only browser evidence. | Owner-approved subjectivesv2 live plan/evidence. | RWO-05 then RWO-06. |
| Fullflow verified? | Fullflow is documented as required future work. | Fullflow verified. | WO-3/4/5/6/7/8 consistently mark fullflow `not_run`. | Safe fullflow execution evidence. | RWO-08. |
| S3/object-storage readiness? | S3-required tasks are out of scope and skipped. A future object-storage-free dev/Trial profile may be used only to unblock ORCA Trial verification while storage-dependent features fail closed. | Attachment storage ready, PHR export storage ready, S3 persistence ready, object-storage deployment ready, or dummy S3/MinIO accepted as evidence. | Current roadmap scope; RUN_ID `20260423T054833Z` non-S3 runtime profile direction. | None required for this roadmap; separate owner-approved S3 plan would be needed for storage readiness. | RWO-06A then RWO-09-RWO-11. |
| Trial-backed release readiness? | Repo-local roadmap, local/static evidence, partial artifact-free browser evidence, RWO-09 non-S3 static/CI evidence, current-head reviewer support package evidence, owner standing approval, the scoped RWO-06 Trial acceptance, and a sanitized-only canonical reviewer packet contract are consolidated. | Production-ready, production ORCA ready, S3/object-storage ready, final Trial-backed release GO, or production release-ready. | Current roadmap scope and manager/release docs; RUN_ID `20260423T030122Z` RWO-09 static/CI evidence; RUN_ID `20260423T034854Z` RWO-10/RWO-11 non-claim marker; RUN_ID `20260423T035517Z` owner standing approval marker; RUN_ID `20260423T112258Z` refreshed RWO-09 non-live release/security gate evidence; RUN_ID `20260423T150257Z` scoped `medicalmodv2` Trial acceptance; RUN_ID `20260423T170226Z` current-head review package refresh; RUN_ID `20260423T180102Z` reviewer submission packet contract hardening. | Final owner GO/NO-GO, a current sanitized reviewer submission packet / accepted-ref freeze, full UI browser/fullflow evidence, and any further live Trial expansion only through approved non-S3 gates. Production ORCA is `not_applicable_trial_only`; S3/object-storage is `not_applicable_out_of_scope`. | RWO-09-RWO-11. |

## Explicit Answers

- Can we claim electronic chart order entry and prescription input are fully verified? No.
- Can we claim ORCA-backed prescription registration is verified? Only for the scoped Trial `medicalmodv2` target; not broadly or release-complete.
- Can we claim generic order ORCA registration is verified? Only for the scoped Trial `medicalmodv2` target; not broadly or release-complete.
- Can we claim disease ORCA registration is verified? No.
- Can we claim SOAP ORCA registration is verified? No.
- Can we claim fullflow is verified? No.
- Can we claim Trial-backed release readiness? Not yet.
- Is owner standing approval present for continuing Trial-backed non-S3 roadmap work? Yes.
- Can we claim production ORCA readiness or production release readiness from this roadmap? No.
- Can we claim S3/object-storage readiness from this roadmap? No.

## RWO-10 / RWO-11 Marker

RUN_ID `20260423T034854Z` records production ORCA readiness as `not_applicable_trial_only` for this automation roadmap. This is a non-claim, not a successful production readiness result.

The current final release decision remains `not_ready`: owner standing approval to proceed is present, scoped `medicalmodv2` Trial acceptance, current-head review package evidence, and a sanitized-only reviewer packet contract now exist, but full UI click-through browser coverage, runtime/fullflow validation, an actual sanitized reviewer submission packet / accepted-ref freeze, and final owner GO/NO-GO are still missing.
