# Subagent C Release Gates Report

RUN_ID: `20260422T135814Z`

Worktree: `../OpenDolphin_WebClient-subagent-c-20260422T134401Z`

Branch: `codex/clinical-roadmap-subagent-c-20260422T134401Z`

HEAD at review start: `7071136c8d9fcd55e9edd9373def0aa005dc737c`

## Scope

This report is advisory markdown only.

Reviewed local documents:

| area | reviewed evidence |
|---|---|
| Release validation | `docs/runbooks/release-validation.md`, `web-client/notes/release-gate.md` |
| Manager release readiness | `docs/managerdocs/README.md`, `docs/managerdocs/02_release_readiness_and_repo_external_signoff.md`, `docs/managerdocs/06_open_unknowns_and_evidence_gaps.md` |
| Current docs / architecture | `docs/README.md`, `docs/architecture/server-modernization-overview.md` |
| WO-5 | `docs/implementation/unified-phase4-handoff-wo5-20260421/` |
| WO-6 | `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/` |
| WO-7 | `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/` |
| WO-8 | `not_found_in_worktree` |

Not performed:

| prohibited class | result |
|---|---|
| live ORCA | not_run |
| ORCA connection test | not_run |
| browser fullflow | not_run |
| credential request/read/log | not_performed |
| production app code edit | none |
| CWP functional code edit | none |

## Executive Verdict

Release readiness is not yet satisfied.

The repo-local documentation defines a clear release gate and the WO-5/WO-6/WO-7 handoffs keep Phase 4 blocked by default. The main remaining blockers are owner/governance decisions and evidence collection, not production code changes in this subagent scope.

Current state:

| item | status |
|---|---|
| WO-5 Phase 4 handoff | prepared, Phase 4 `not_run` |
| WO-6 Phase 4 execution prompt | prepared, `may_run_phase4=false`, owner approval request may be made |
| WO-7 pre-execution readiness | `PREEXEC_BLOCKED_APPROVAL_SCOPE` |
| WO-8 | `not_found_in_worktree` |
| actual Phase 4 live execution | blocked until separate explicit owner approval |
| release-ready | blocked by Phase 4 approval/execution decision plus repo-external release sign-off |

## Threat And Misuse Cases Considered

| misuse case | release impact | required control |
|---|---|---|
| Treat WO-5/WO-6/WO-7 docs as approval to run Phase 4 | unintended live ORCA mutation | require a separate future owner approval token/reference and re-run command guard before any live command |
| Promote local/MSW/static/server/package evidence to live ORCA business success | false release readiness | keep evidence classes separate and require endpoint-specific sanitized live business evidence if Phase 4 is approved |
| Reuse old Phase 3, candidate discovery, package, or sidecar artifacts as current evidence | stale or wrong-patient release evidence | bind every package/sidecar/evidence summary to current RUN_ID, source commit, artifact hash, and approved target |
| Capture raw ORCA bodies, patient/insurance detail, credentials, cookies, tokens, HAR, trace, video, screenshot, or raw network dumps | credential or patient data exposure | sanitized summaries only; dynamic scan and package source-scope scan must fail closed on raw artifacts |
| Expand the target from `00001 / 00001` to `00002` through `00011` by implication | wrong-patient mutation risk | future approval must restate target exactly; non-target candidates remain `not_run` |
| Treat `acceptedCandidateCount=0` as official patient absence | incorrect clinical/test-data conclusion | report only mutation-ready readiness classification, not official patient absence |

## Release Gate Matrix

| gate ID | gate | source | current status in reviewed docs | owner decision needed | blocker if unresolved | required evidence before release |
|---|---|---|---|---|---|---|
| RG-01 | web-client full CI | `docs/runbooks/release-validation.md`, `web-client/notes/release-gate.md` | release mandatory | none for command existence | failure or missing current run | `cd web-client && npm run ci` pass on accepted source |
| RG-02 | server static-analysis verify | `docs/runbooks/release-validation.md`, `docs/architecture/server-modernization-overview.md` | release mandatory | none for command existence | failure or missing current run | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` pass on accepted source |
| RG-03 | runtime-ready smoke | `docs/runbooks/release-validation.md`, `web-client/notes/release-gate.md` | release mandatory, every-PR status unknown | Release owner / GitHub admin must decide every-PR required yes/no | release gate incomplete if not run before release; governance incomplete if every-PR decision unrecorded | `cd web-client && node scripts/runtime-ready-smoke.mjs` pass or blocker classified with saved sanitized log |
| RG-04 | ORCA route taxonomy and blocked-route guard | `docs/runbooks/release-validation.md` | required in final acceptance order | none unless new route is proposed | current taxonomy drift or blocked route surface in production source | grep results and `verify:web-guard` / guard category counts showing retained strings are only allowed negative/test/docs surfaces |
| RG-05 | server route inventory/exposure tests | `docs/runbooks/release-validation.md` | required in final acceptance order | none | public ORCA route taxonomy or web.xml exposure drift | focused Maven test pass for `PublicRouteInventoryContractTest`, `WebXmlEndpointExposureTest`, and listed ORCA resource tests |
| RG-06 | patients official/local boundary regression | `docs/runbooks/release-validation.md` | required in final acceptance order | none | local/official route mixing or canonical sync regression | focused Maven and web-client test pass for patient create/update/import/local search boundary |
| RG-07 | targeted web UI semantics | `docs/runbooks/release-validation.md` | required in final acceptance order | none | current wording/semantics drift, wrong `medicalInformation` payload behavior | listed web-client test pass and proof that unset `medicalInformation` is omitted |
| RG-08 | reviewer submission packet | `docs/runbooks/release-validation.md`, `docs/runbooks/reviewer-submission-packet.md` | required closeout/review artifact | Release owner selects accepted branch/head | packet invalid or branch drift not pinned | create/validate reviewer submission packet pass with accepted HEAD fixed when needed |
| RG-09 | GitHub required checks and branch protection | `docs/managerdocs/02_release_readiness_and_repo_external_signoff.md` | repo-external unknown | GitHub admin and Release owner | release-ready NO-GO while unknown | branch protection settings, exact check names, required/not-required decisions, stale check cleanup evidence |
| RG-10 | production DB/config/secrets | `docs/managerdocs/02_release_readiness_and_repo_external_signoff.md` | repo-external unknown | Infra/Ops, Security, Release owner | release-ready NO-GO while any blocking item unknown | secret/config registration evidence, sanitized manifest, startup/connectivity evidence without raw values |
| RG-11 | ORCA credential protection and approved channel | `docs/managerdocs/02_release_readiness_and_repo_external_signoff.md`, WO-6/WO-7 docs | repo-external unknown; raw values forbidden | Infra/Ops / Security / owner | live ORCA work and release blocked if unsafe or unapproved | set/unset/classification-only credential handling proof; no raw credential, URL, Cookie, Authorization, session, CSRF, or password in evidence |
| RG-12 | Phase 4 approval scope | WO-6/WO-7 docs | blocked; `owner_approval_token_absent_for_execution` | Owner must explicitly approve or decline future live execution | Phase 4 cannot run; release must either block or formally waive/re-scope with documented risk | separate future approval reference naming Phase 4 execution, one-time target `00001 / 00001`, no fullflow unless approved, no Phase 3 retry, no RN02/03/04 unless approved, sanitized evidence policy accepted |
| RG-13 | Phase 4 live business evidence if approved | WO-5/WO-6/WO-7 docs, `docs/runbooks/release-validation.md` | not_run | Owner must approve live execution first | cannot claim Phase 4/live ORCA success | sanitized endpoint-specific result, business criteria, dynamic evidence scan, package source-scope scan, artifact ledger, no raw artifacts |
| RG-14 | release cutover/rollback governance | `docs/runbooks/release-validation.md`, `docs/releases/orca-remediation-cutover.md` reference | required after gates | Release owner | release cannot proceed without GO/NO-GO record | dated GO/NO-GO/PENDING decision, accepted branch/head, rollback/cutover record, blocker classification |

## Owner Decisions Required

| decision ID | owner | required decision | default if absent | evidence to record |
|---|---|---|---|---|
| OD-01 | Release owner | Is Phase 4 required for this release, or is release re-scoped without it? | blocked | written GO/NO-GO/PENDING decision and rationale |
| OD-02 | Owner after ChatGPT/reviewer acceptance | If Phase 4 is required, approve a separate execution task | no approval, `may_run_phase4=false` | scope-bound approval token/reference, target, allowed action/request, fullflow policy, RN02/03/04 policy |
| OD-03 | Infra/Ops / Security | Approved credential delivery channel for any future ORCA work | blocked | channel classification only; no values |
| OD-04 | GitHub admin / Release owner | Exact required checks and branch protection settings | release-ready unknown | branch protection evidence, exact check names, stale required checks removed or justified |
| OD-05 | Release owner / GitHub admin | Whether `runtime-ready-smoke.mjs` is every-PR required | governance incomplete | yes/no decision, and branch protection evidence if yes |
| OD-06 | Infra/Ops / Security | Production DB, DB CA, ORCA credential protection, 2FA AES, document integrity keyring, S3, trusted proxies | release-ready NO-GO | sanitized config/secret registration and startup/connectivity evidence |
| OD-07 | Reporting owner / Release owner | Whether reporting signing keystore/TSA are in scope for this release | conditional blocker | not-needed decision or configured evidence |
| OD-08 | Release owner | Accepted branch/head for final reviewer submission packet | packet cannot be authoritative | accepted ref/head and packet validation output |

## Current Blockers

| blocker | source | classification | blocking scope | next action |
|---|---|---|---|---|
| `owner_approval_token_absent_for_execution` | WO-7 | governance / approval | Phase 4 execution | owner must provide separate future scope-bound approval, or release owner must re-scope release without Phase 4 |
| WO-8 docs absent | local worktree search | `not_found_in_worktree` | sequence clarity | do not infer a WO-8 outcome; create a future WO-8 only with explicit owner instruction |
| GitHub required checks unknown | managerdocs | repo-external | release-ready | GitHub admin records exact checks and branch protection |
| production secrets/config unknown | managerdocs | repo-external | release-ready | Infra/Ops records sanitized deployment/config evidence |
| every-PR runtime smoke decision unknown | managerdocs / release-gate note | governance | release policy | Release owner decides and records yes/no |
| live ORCA evidence not current for Phase 4 | WO-5/WO-6/WO-7 | intentional not-run | live ORCA success claim | keep as future work requiring explicit owner approval and sanitized evidence |
| WO-2 reopen package evidence owner-waived/not_verified | WO-5/WO-6/WO-7 | boundary / waiver | evidence strength | keep as non-success evidence; do not promote to acceptance proof |

## Evidence Needed

| evidence class | needed item | acceptable form | unacceptable form |
|---|---|---|---|
| Static/local release gates | web CI, server static-analysis verify, runtime-ready smoke, targeted route/UI tests | current command logs with exit status and artifact paths | stale logs, old RUN_ID, unsupported waiver without owner acceptance |
| GitHub governance | branch protection, exact check names, required status | settings screenshot/text, completed run URLs, decision memo | assumptions from repo docs alone |
| Production config | DB, CA, ORCA credential protection key, 2FA AES, document integrity keyring, S3, proxies | sanitized manifest, secret manager record, startup/connectivity evidence with values omitted | raw secrets, raw connection strings, credential-bearing URLs |
| Future ORCA execution approval | owner approval token/reference | separate future task text naming exact scope and target | broad approval, example token text, prompt-preparation approval |
| Future ORCA business evidence | Phase 4 result if approved | sanitized JSON/MD with business categories, hash, target, source commit, command metadata | raw ORCA request/response, raw patient/insurance detail, HAR, trace, video, screenshot, raw network dump |
| Package integrity | final ZIP metadata, source-scope scan, artifact ledger | sidecars bound to exact final ZIP sha256 and current RUN_ID | stale sidecars, embedded post-package metadata that changes ZIP hash, self-referential ledger drift |
| Reviewer submission | packet validation | packet-relative paths, accepted HEAD match, no absolute local paths | old package, separate zip supplementation, absolute local paths |

## Remaining Work Order Sequence Through Release

This sequence is advisory. It does not create approval to execute live ORCA work.

| proposed order | purpose | prerequisites | allowed work | completion evidence | stop condition |
|---|---|---|---|---|---|
| WO-8 | `not_found_in_worktree`; recommended next decision gate if owner wants to continue Phase 4 path | WO-7 accepted as blocked; owner decides whether Phase 4 is release-blocking | docs-only owner decision intake, no live commands | written decision: approve separate Phase 4 execution, decline, or re-scope release | any attempt to treat WO-8 placeholder as existing acceptance |
| WO-9 | future Phase 4 execution, only if separately approved | explicit scope-bound owner approval after review; credential channel approved; target `00001 / 00001`; command guard rechecked | only the named approved wrapper/action; no Phase 3 retry; no fullflow unless explicitly approved; no RN02/03/04 unless explicitly approved | sanitized business result, command metadata, dynamic scan, package/source-scope scan, artifact ledger | missing/ambiguous approval, target drift, raw artifact risk, credential redaction uncertainty |
| WO-10 | post-Phase4 evidence closeout, or release re-scope closeout if Phase 4 is declined | WO-9 completed or owner re-scope decision | docs/package/evidence only | final report with accepted/blocked/re-scoped status; no overclaims | `not_run`, `not_verified`, HTTP 200, wrapper exit 0, local/static evidence promoted to live success |
| WO-11 | full release-validation run on accepted source | accepted branch/head selected | non-credential static/local commands and runtime smoke; live ORCA only if separately approved by owner | all release-validation mandatory commands and focused regressions pass, or blockers classified | command fails without accepted waiver, secret/config required, or live ORCA would run without approval |
| WO-12 | repo-external release sign-off | WO-11 evidence available | GitHub branch protection and production config/secrets evidence collection | GO/NO-GO/PENDING with owner/date/evidence references | any blocking external unknown remains |
| WO-13 | reviewer submission packet and cutover decision | accepted branch/head, closeout evidence, repo-external sign-off | packet generation/validation and release owner decision | validated reviewer submission packet, accepted HEAD match, cutover/rollback record | packet mismatch, stale sidecar, absolute path, raw sensitive evidence, branch drift not pinned |

## Future Live ORCA Work Rules

All live ORCA work remains future work.

Minimum rules before any such work:

| rule | required state |
|---|---|
| approval | separate explicit owner approval after review; prompt-preparation approval is not enough |
| scope | exact target `00001 / 00001` unless owner explicitly changes scope |
| prohibited by default | Phase 3 retry, fullflow, Request_Number `02`/`03`/`04`, targets `00002` through `00011` |
| credentials | approved secure channel or runtime variables only; evidence records set/unset/classification only |
| artifacts | sanitized JSON/MD only |
| forbidden evidence | raw ORCA bodies, raw patient/insurance details, credentials, Cookie, Authorization, JSESSIONID, CSRF, raw password, session/token values, credential-bearing URLs, HAR, trace, video, screenshot, raw network dumps |
| success criteria | endpoint-specific business evidence, not HTTP 200 or wrapper exit 0 alone |
| package | current final ZIP, current sidecars, exact hash binding, source-scope scan, artifact ledger |

## Recommendations

1. Do not start Phase 4 from WO-5/WO-6/WO-7 artifacts. The current correct state is `may_run_phase4=false`.
2. Create a separate owner decision record before any WO-8/WO-9 task. If the owner does not explicitly approve Phase 4 execution, keep it blocked or re-scope the release in writing.
3. Close repo-external release blockers in parallel with any Phase 4 decision: GitHub required checks, production config/secrets, runtime smoke policy, and GO/NO-GO record.
4. For final release validation, use `docs/runbooks/release-validation.md` as the command order and keep all live ORCA commands behind separate approval.
5. Preserve the WO-2 waiver boundary. It may explain why work proceeded, but it is not success evidence.

## Final Advisory Status

`ADVISORY_COMPLETE_RELEASE_READY_BLOCKED_PENDING_OWNER_AND_EXTERNAL_EVIDENCE`

Subagent C produced only this advisory markdown and did not run live ORCA, ORCA connection tests, browser fullflow, credential commands, or production/CWP code changes.
