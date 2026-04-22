# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-22
source_work_order: WO-8
blocker_id: phase4-safe-wrapper-action-missing
priority: high

## Context

WO-8 stopped before live ORCA traffic with `PHASE4_BLOCKED_HARNESS_OR_EVIDENCE_POLICY`. The documented blocker is not owner approval in general; the blocker is that the exact approved safe Phase 4 wrapper/action could not be identified. The available fullflow harness may create forbidden screenshot/network/request XML/body-derived artifacts, and the sanitized acceptmodv2 wrapper is Phase 3-only.

The owner grants standing approval for ORCA Trial work needed by the release-readiness roadmap, but production ORCA remains out of scope unless a separate production approval document exists.

## Goal

Resolve the WO-8 blocker by defining, documenting, or implementing a safe Phase 4 ORCA Trial wrapper/action that can be used by a later live Trial verification step without forbidden raw artifact capture.

## Allowed Actions

- Read current WO-5, WO-6, WO-7, WO-8, release-readiness, and automation-handoff docs.
- Inspect existing `web-client/scripts`, `server-modernized` ORCA transport/resources, and tests.
- Add or modify docs, tests, and narrowly scoped wrapper/harness code if needed.
- Add dry-run, parser, sanitizer, or local contract tests.
- Run local lint/typecheck/test commands relevant to the wrapper.
- Run ORCA Trial read-only checks only if they emit sanitized evidence and no raw patient/insurance detail.
- Run live ORCA Trial mutation only after this prompt's completion criteria are met and a follow-on prompt specifies exact endpoint, request class, target, and business success criteria.

## Forbidden Actions

- Production ORCA execution.
- Phase 3 retry rerun unless a later prompt explicitly reopens it.
- Request_Number `02` / `03` / `04` unless a later prompt explicitly approves it.
- Mutating `00002` through `00011` unless a later prompt explicitly approves it.
- HAR, trace, video, screenshot, raw network dump, request XML, or raw body-derived artifact capture.
- Raw ORCA request body or response body capture.
- Raw patient detail or raw insurance detail capture.
- Credential, password, cookie, token, Authorization, JSESSIONID, CSRF, or session capture.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Treating HTTP 200, wrapper exit 0, dry-run, precheck, not_run, not_verified, or owner-waived evidence as business success.

## Required Evidence

- Sanitized command log.
- Exact proposed wrapper/action name.
- Endpoint and request class.
- Target patient/candidate scope.
- Dry-run or local parser/sanitizer test result.
- Secret/raw-artifact scan result.
- Business success criteria based only on allowlisted parsed fields.
- Updated release/readiness docs if scope or sequencing changes.

## Completion Criteria

Complete this prompt only when one of the following is true:

- A safe Phase 4 Trial wrapper/action is documented and locally test-verified, with forbidden artifact capture prevented.
- The blocker is proven unresolvable without a policy or owner decision, and a new active handoff prompt is created for that decision.

## Stop Conditions

- A safe wrapper cannot avoid forbidden raw artifacts.
- Exact endpoint, request class, or target scope remains ambiguous.
- Credentials are missing or would need to be printed.
- Production ORCA would be required.
- The task requires a business decision outside standing Trial approval.
- Repeated local repair attempts fail without new evidence.

## Final Report Requirements

Report:

- files changed
- tests/checks run
- live Trial ORCA action status
- credentials captured: expected `no`
- raw artifacts captured: expected `no`
- next prompt status
