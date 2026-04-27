# Feature Status Ledger

RUN_ID: `20260422T134401Z`

| Feature | Current status | Release claim permitted now? | Primary source |
|---|---|---|---|
| Karte order/document persistence | Local/server evidence accepted | Local/static only | CWP-01 integration gate |
| SOAP local input/reload | Accepted | Local/static only | CWP-02 |
| Disease entry/readback | Accepted | Local/static only | CWP-05 |
| Prescription input | Accepted local flow | Local/static only | CWP-03 |
| Generic order input | Accepted local matrix | Local/static only | CWP-04 |
| Document two-phase failure | Accepted local/component behavior | Local/static only | CWP-06 |
| acceptmodv2 | Limited Trial ORCA success for prior `00001` Phase 3 | Limited trial-only acceptmodv2 | Phase 3 retry summary |
| medicalmodv2 | Limited Trial ORCA accepted checkpoints for `testOrder/600` v3 and `radiologyOrder/700` v3; other families remain blocked or not accepted | Limited endpoint-specific trial-only anchors; no broad all-order claim | RWO-06J RUN_ID `20260427T013313Z`, RWO-06K RUN_ID `20260427T020309Z`, PHASE4 ledger lock RUN_ID `20260427T150350Z` |
| diseasev3 | Read-only before-state baseline only; no mutation acceptance | No | CWP-05 boundary / DISEASEV3 baseline RUN_ID `20260427T150350Z` |
| subjectivesv2 | Not run live | No | CWP-02 boundary |
| Browser e2e | Not run for Clinical Wave 1 | No | WO-3/4 |
| Fullflow | Not run | No | WO-3/4/5/6/7/8 |
| Trial ORCA | Limited | Limited acceptmodv2 only | Phase 3 retry, WO-8 |
| Production ORCA | Not applicable to Trial-only roadmap | No production ORCA claim | Roadmap ORCA connection scope |
| S3/object storage | Not applicable to current roadmap; disabled profile implemented for Trial runtime only | No S3/object-storage claim | Roadmap S3/object-storage scope / RWO-06A |
| Trial-backed non-S3 release readiness | Not ready | No | Release gate matrix |
