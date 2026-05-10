# OpenDolphinNext ORCA EHR Completion Workstream

- Status: active implementation workstream
- RUN_ID: `20260510T092335Z`
- Created: 2026-05-10
- Primary checklist: [opendolphin-next-orca-ehr-implementation-checklist.md](./opendolphin-next-orca-ehr-implementation-checklist.md)

## Purpose

This workstream tracks the remaining implementation needed for OpenDolphinNext to operate as an ORCA / WebORCA connected electronic health record with production-grade source-of-truth boundaries, chart immutability, prescription authority, billing linkage, auditability, medical-safety UI, and release verification.

The checklist in this directory is an implementation planning document. It does not replace the current contracts under `docs/contracts/` or `web-client/notes/`. When a checklist item changes a durable contract, the implementation task must update the relevant contract document in the same change.

## Source-Of-Truth Boundary

- Current runtime contracts remain under `docs/contracts/`.
- Web client current contracts remain under `web-client/notes/`.
- Release validation remains under `docs/runbooks/release-validation.md`.
- This directory is the active workstream checklist and iteration record for the EHR completion effort.

## Operating Rules

- Begin each iteration with a fresh `RUN_ID`, `git status --short`, and current branch check.
- Treat browser/client input as untrusted. ORCA identifiers, facility, owner, storage keys, digest, URL, voucher, sequential number, insurance combination, and role claims must be resolved or verified server-side.
- Keep ORCA credentials, connection URL, certificate material, raw XML, patient details, insurance details, cookies, CSRF tokens, HAR, trace, video, and screenshots out of tracked evidence.
- Work only in `web-client/`, `server-modernized/`, sibling modernized modules, `docs/`, `ops/`, `scripts/`, and `tests/` unless explicitly instructed otherwise.
- `client/` and `server/` are legacy references only.

## Done Definition

The workstream is complete only when the checklist release gates are satisfied, focused tests for changed areas pass, and the full gates below pass or have an explicitly documented external blocker:

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```
