# Clinical Functional Release Readiness Roadmap

RUN_ID: `20260422T134401Z`

## Purpose

This documentation set consolidates the current OpenDolphinNext clinical functional verification status from existing repo-local evidence. It is documentation-only and does not implement features, execute live ORCA, run fullflow, request credentials, or change CWP functional code.

## ORCA Connection Scope

This roadmap assumes WebORCA / ORCA Trial as the only ORCA connection target. Production ORCA connectivity, production ORCA credentials, production patient data, and production ORCA functional execution are out of scope and are not required for this automation plan.

Trial evidence must remain bounded to Trial-backed release-readiness progress. It must not be used to claim production ORCA readiness.

## S3 / Object Storage Scope

This roadmap skips tasks that require S3, MinIO, object-storage credentials, attachment-storage S3 configuration, or PHR export S3 configuration. S3-required tasks are classified as `skipped_s3_required_out_of_scope`, not as blockers for the rest of the automation.

This roadmap does not claim attachment storage, PHR export storage, S3 persistence, or object-storage deployment readiness.

## Final Working Conclusion

- Electronic chart / karte local persistence has targeted local/server/component/static evidence, but full end-to-end release readiness is not established.
- SOAP and disease local workflows have targeted local/server/component/static evidence, but `subjectivesv2` and `diseasev3` live ORCA success are not claimed.
- Prescription and generic order input have local/static/server/component evidence only; ORCA-backed browser/fullflow/live verification remains pending.
- Existing live ORCA evidence is limited to the earlier Trial Phase 3 `acceptmodv2` retry for `00001 / 00001`, classified as `businessAcceptedWithWarnings`; it does not prove medicalmodv2, diseasev3, subjectivesv2, fullflow, all patients, or production ORCA.
- WO-8 exists and was incorporated; it stopped before live ORCA traffic with `PHASE4_BLOCKED_HARNESS_OR_EVIDENCE_POLICY`.
- Trial-backed non-S3 release readiness cannot be claimed until browser e2e, non-S3 Trial ORCA expansion, security/config/deployment, package, CI, rollback, and owner sign-off gates have actual evidence. Production ORCA and S3/object-storage readiness are non-claims for this roadmap.

## Documents

- [FINAL_REPORT.md](FINAL_REPORT.md)
- [MAIN_AGENT_REPORT.md](MAIN_AGENT_REPORT.md)
- [RELEASE_READINESS_EXECUTIVE_SUMMARY.md](RELEASE_READINESS_EXECUTIVE_SUMMARY.md)
- [FUNCTIONAL_VERIFICATION_MATRIX.md](FUNCTIONAL_VERIFICATION_MATRIX.md)
- [FUNCTIONAL_CLAIMS_BOUNDARY.md](FUNCTIONAL_CLAIMS_BOUNDARY.md)
- [ORCA_LIVE_VERIFICATION_GAP_MATRIX.md](ORCA_LIVE_VERIFICATION_GAP_MATRIX.md)
- [FULLFLOW_AND_BROWSER_E2E_GAP_MATRIX.md](FULLFLOW_AND_BROWSER_E2E_GAP_MATRIX.md)
- [RELEASE_GATE_MATRIX.md](RELEASE_GATE_MATRIX.md)
- [REMAINING_WORK_BREAKDOWN.md](REMAINING_WORK_BREAKDOWN.md)
- [WORKPLAN_TO_RELEASE.md](WORKPLAN_TO_RELEASE.md)
- [FEATURE_STATUS_LEDGER.md](FEATURE_STATUS_LEDGER.md)
- [EVIDENCE_SOURCE_MAP.md](EVIDENCE_SOURCE_MAP.md)
- [DECISION_LOG.md](DECISION_LOG.md)
- [RISK_REGISTER.md](RISK_REGISTER.md)
- [UI_DADS_RELEASE_READINESS_NOTES.md](UI_DADS_RELEASE_READINESS_NOTES.md)
- [SUBAGENT_REPORTS_SUMMARY.md](SUBAGENT_REPORTS_SUMMARY.md)
