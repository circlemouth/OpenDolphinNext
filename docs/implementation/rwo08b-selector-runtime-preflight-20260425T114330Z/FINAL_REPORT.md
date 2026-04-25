# RWO-08B Selector Runtime Preflight

RUN_ID: `20260425T114330Z`

## Result

`RWO08B_SELECTOR_RUNTIME_PREFLIGHT_ACCEPTED_FULLFLOW_BLOCKED_CANONICAL_HANDOFF`

The approved non-S3 WebORCA Trial runtime profile started successfully through the local server port. The exact read-only selector preflight now passes for Trial candidate `00001` using the server-authoritative selector option flow.

Diagnostic fullflow was attempted once after the read-only selector preflight passed. It remains blocked before order send because the canonical Charts handoff did not become available after accept within the harness timeout. No request XML was created, and no L4 fullflow or Trial order-send business success is claimed.

## Runtime

| Check | Result |
|---|---|
| Profile | `orca-trial-no-object-storage` |
| Object storage / S3 | not configured; storage readiness not claimed |
| Server health/readiness | `200` / `200` on `http://localhost:9080/openDolphin/api/health` and `/api/health/readiness` |
| Reverse proxy health/readiness | `000` / `000`; local server path remained usable |
| Runtime-ready smoke | pass; summary sha256 `4c5ffba4873e37211e0878708f1ad752fec7f9e6397ae0546694b54466eed154` |

## Read-Only Selector Preflight

| Field | Result |
|---|---|
| Wrapper | `web-client/scripts/qa-weborca-readonly-preflight.mjs` |
| Candidate | `00001` |
| Input identity hash | `cda1fa5007dcafc86b6e46696c8624d3dd0f393f652ae5ce60a158fef1fb5140` |
| Official patient | HTTP `200`, `apiResult=00`, exact ID matched |
| Insurance | accepted, `apiResult=000`, effective count `2` |
| Appointment dependency | direct acceptance, accepted; appointment `21`, visit `13` |
| Selector readiness | accepted |
| Selector option counts | department `6`, physician `6`, payment mode `3`, visit kind `4`, medical information `9` |
| Mutation policy | prohibited; `targetMutationRequestCount=0`, `blockedRequestCount=0` |
| Summary sha256 | `68e66f5a42cea9fe900d506c797d161178aeb786b04a0e1303580f5a6ba468fd` |

## Diagnostic Fullflow

The fullflow run was blocked with:

- classification: `test-data-blocker`
- reason: `canonical_charts_handoff_timeout_after_accept`
- order send reached: `false`
- request XML created: `false`
- business accepted: `false`

The first diagnostic run wrote to a non-repo parent artifact directory due the script default path. Those generated artifacts were deleted before evidence use, and the committed evidence here records only sanitized status, counts, hashes, route identity, and blocker classification. No raw screenshots, HAR, traces, videos, network dumps, raw ORCA bodies, patient details, insurance details, credentials, cookies, or auth headers were committed or packaged.

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| Selector readiness is claimed from UI-injected or display-string-derived options. | Rejected by preflight: selector readiness was based on current UI options populated through the server-authoritative selector route; no display-string synthesis or DOM injection evidence was used. |
| Read-only preflight accidentally sends `acceptmodv2` mutation. | `targetMutationRequestCount=0`; mutation policy remained prohibited. |
| Fullflow blocker is overclaimed as business success. | Classified as blocked before canonical Charts handoff; no order send or request XML success is claimed. |
| Diagnostic artifact contents leak into tracked evidence. | Only sanitized Markdown/JSON summaries were committed; diagnostic raw artifacts were not retained as release evidence. |

## Claim Boundary

Allowed claim: exact read-only selector preflight passes for current Trial direct-acceptance candidate `00001` with server-authoritative selector options.

Not claimed: diagnostic fullflow success, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness.

## Next Action

Investigate why accepted direct candidate `00001` does not produce canonical Charts handoff after accept. Use no-live/browser diagnostics or a changed runtime/test-data precondition before any further diagnostic fullflow retry.
