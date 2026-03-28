# Phase3+ post-decision implementation dev doc

## Goal
Encode the already-made repo-only decisions into repo-local truth.

Specifically:
- [ ] Canonicalize the static-analysis execution contract.
- [ ] Restore a dedicated static-analysis PR workflow.
- [ ] Make the minimal release gate explicit in repo-visible docs.

## Constraints
- [ ] Current repo is the source of truth.
- [ ] Backward compatibility is not a goal.
- [ ] Unknown repo-external settings stay `unknown`.
- [ ] Keep SpotBugs / FindSecBugs fail-on-error.
- [ ] Keep Checkstyle / PMD skipped.
- [ ] Do not reopen closed Phase2 topics.
- [ ] Do not add broad new quality gates.
- [ ] Ignore build artifacts.

## Workstream 1: inventory and conflict map
- [ ] Identify all static-analysis entry points actually present in the repo.
- [ ] Identify all relevant workflows and their triggers / job names / command invocations.
- [ ] Identify whether `scripts/server-modernized/verify-static-analysis.sh` exists and whether it is already the canonical entry point.
- [ ] Identify any contradictory module-local static-analysis profile semantics in `server-modernized/pom.xml` vs `pom.server-modernized.xml`.
- [ ] Produce a concise conflict map for the parent agent.

## Workstream 2: canonicalize static-analysis execution contract
- [ ] Choose one canonical static-analysis command.
- [ ] Prefer an existing wrapper if it already matches the desired semantics; otherwise keep the root Maven command authoritative.
- [ ] Remove, rename, or make non-default any conflicting module-local static-analysis profile semantics that would make the contract ambiguous.
- [ ] Preserve fail-on-error semantics for the authoritative gate.
- [ ] Do not expand Checkstyle / PMD scope.

## Workstream 3: restore dedicated static-analysis PR workflow
- [ ] Restore `pull_request` execution for static-analysis only.
- [ ] Keep manual / scheduled execution only if still useful; do not drop them without reason.
- [ ] Ensure the workflow uses the canonical static-analysis entry point exactly once.
- [ ] Do not mix runtime smoke or broader release-critical checks into this workflow unless the current repo already makes that separation impossible.
- [ ] Keep naming and comments repo-truthful.

## Workstream 4: codify minimal release gate docs
- [ ] Update repo-visible docs so the minimum mandatory release gate is explicit:
  - [ ] `cd web-client && npm run ci`
  - [ ] `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
  - [ ] `cd web-client && node scripts/runtime-ready-smoke.mjs`
- [ ] Mark other useful entry points as recommended / optional / unknown instead of silently implying they are mandatory.
- [ ] Avoid creating a redundant wrapper unless it materially reduces drift.
- [ ] Prefer README / verification-plan updates over adding new code if docs alone are sufficient.

## Validation
- [ ] Canonical static-analysis command passes.
- [ ] `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile` still passes.
- [ ] Workflow YAML is syntactically valid.
- [ ] No duplicate or contradictory static-analysis gate path remains in repo-visible workflows/docs.
- [ ] Updated docs use real command names that exist in the repo.

## Non-goals
- [ ] No branch-protection changes.
- [ ] No required-check changes outside the repo.
- [ ] No Checkstyle / PMD enablement.
- [ ] No new feature implementation.
- [ ] No broad test expansion.
- [ ] No reopen of closed Phase2 areas.

## Deliverables
- [ ] Updated repo files.
- [ ] A short summary of the chosen canonical static-analysis entry point.
- [ ] A short summary of workflow changes.
- [ ] A short summary of release-gate doc changes.
- [ ] Validation commands and outcomes.
- [ ] Remaining `unknown` items, if any.
