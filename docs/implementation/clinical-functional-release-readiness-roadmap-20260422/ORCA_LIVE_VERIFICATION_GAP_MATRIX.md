# ORCA Live Verification Gap Matrix

RUN_ID: `20260422T134401Z`

| Target | Current evidence | Scope restrictions | Live mutation run? | Business success established? | Sanitized evidence exists | Still needed | Owner approval required | Credentials required | Raw artifact capture prohibited |
|---|---|---|---|---|---|---|---|---|---|
| acceptmodv2 | Prior Phase 3 retry for `00001 / 00001`: `K3`, `businessAcceptedWithWarnings`, mutationSuccess true, C7 accepted. WO-8 did not run. | Trial only, `00001` only, Request_Number 01 intended. | yes, prior Phase 3 only | yes, limited to prior target | yes | Decide whether any additional acceptmodv2 scope is needed. | yes for any future live run | yes, via approved channel only | yes |
| medicalmodv2 | Local prescription/generic order boundary evidence only. | No live claim. | no | no | local docs only | Owner-approved live medicalmodv2 plan with endpoint-specific success criteria. | yes | yes | yes |
| diseasev3 | Disease local readback evidence only. | No live claim. | no | no | local docs only | Owner-approved live diseasev3 plan. | yes | yes | yes |
| subjectivesv2 | SOAP local save explicitly does not call ORCA subjectivesv2. | No live claim. | no | no | local docs only | Owner-approved subjectivesv2 plan, if in release scope. | yes | yes | yes |
| Request_Number 01 | Intended Phase 3 registration request number for prior acceptmodv2. | Prior accepted evidence only; do not rerun Phase 3 in this roadmap. | yes, prior Phase 3 | yes, limited | yes | No replay; only future explicit approval if required. | yes | yes | yes |
| Request_Number 02 | Explicitly not run. | Forbidden in current evidence scope. | no | no | no | Separate planning/approval if business requires it. | yes | yes | yes |
| Request_Number 03 | Explicitly not run. | Forbidden in current evidence scope. | no | no | no | Separate planning/approval if business requires it. | yes | yes | yes |
| Request_Number 04 | Explicitly not run. | Forbidden in current evidence scope. | no | no | no | Separate planning/approval if business requires it. | yes | yes | yes |
| `00001` | Prior Trial acceptmodv2 Phase 3 limited success; WO-8 planned target but did not execute. | Cannot infer fullflow, medicalmodv2, diseasev3, or subjectivesv2. Production ORCA is out of scope. | yes, prior acceptmodv2 only | yes, acceptmodv2 only | yes | Safe next target/action definition if more live Trial work is approved. | yes | yes | yes |
| `00002` through `00011` | Not run. | Mutation prohibited in current scope. | no | no | no | Separate explicit owner approval and readiness evidence. | yes | yes | yes |
| Trial ORCA | Limited prior acceptmodv2 success; WO-8 no live traffic. | Trial only, not production. | yes, limited | yes, limited | yes | Expand one endpoint/target at a time. | yes | yes | yes |
| Production ORCA | Not applicable to this roadmap. | Production ORCA connectivity, credentials, patient data, and functional execution are out of scope. | no | no | no | No action in this automation; keep as explicit non-claim. | separate production plan only | no for this roadmap | yes |

## WO-8 Incorporated Verdict

WO-8 was found and incorporated. Its verdict was `PHASE4_BLOCKED_HARNESS_OR_EVIDENCE_POLICY`; live ORCA action, authentication/session establishment, mutation, fullflow, Request_Number `02/03/04`, and `00002` through `00011` all remained `not_run`.
