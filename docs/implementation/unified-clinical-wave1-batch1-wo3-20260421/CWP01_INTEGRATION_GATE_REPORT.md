# CWP-01 Integration Gate Report

RUN_ID: `20260421T142818Z`

## Decision

`ACCEPTED FOR WAVE 1 BASE`

## Inputs Verified In Main Worktree

- Base branch: `codex/wo3-clinical-wave1-batch1-main-20260421`
- Base commit: `672c37c7e15a8247c950b9f27f378ad3eeb30039`
- Reported CWP-01 commit: `f6121aa2376d734c2a876bb8c9626f9caa963145`
- Reported CWP-01 commit ancestry: included in current base commit
- Reported artifact: `artifacts/codex/clinical-input-cwp01-karte-order-persistence-20260421.zip`
- Reported artifact SHA-256: `bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2`
- Observed artifact SHA-256: `bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2`
- Artifact listing: 11 source/test/docs files, no build artifact path observed in `unzip -l` output

## Main-Worktree Commands

| Command | Exit code | Log |
|---|---:|---|
| `git diff --check` | 0 | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/command-logs/20260421T142818Z-cwp01-git-diff-check.log` |
| `bash server-modernized/tools/ci/check-doc-links.sh` | 0 | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/command-logs/20260421T142818Z-cwp01-doc-link-check.log` |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=CanonicalOrderDocumentFixtureTest,KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest,KarteRevisionSnapshotContractTest,KarteRevisionDocumentResponseJsonTest,KarteDocumentSnapshotContractTest,DocumentIntegrityServiceTest test` | 0 | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/command-logs/20260421T142818Z-cwp01-maven-gate.log` |
| `shasum -a 256 artifacts/codex/clinical-input-cwp01-karte-order-persistence-20260421.zip` | 0 | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/command-logs/20260421T142818Z-cwp01-artifact-sha256.log` |
| `unzip -l artifacts/codex/clinical-input-cwp01-karte-order-persistence-20260421.zip` | 0 | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/command-logs/20260421T142818Z-cwp01-artifact-unzip-list.log` |

## Test Result

- Tests run: 24
- Failures: 0
- Errors: 0
- Skipped: 0

## Boundary

- CWP-01 is accepted only as the WO-3 integration base.
- CWP-01 evidence is local/server source and targeted Maven evidence.
- Playwright/e2e/runtime browser: not run, not claimed.
- Phase 3 retry rerun: no.
- Phase 4: not_run.
- Fullflow: not_run.
- Live ORCA mutation: no.
- Live medicalmodv2 success: not claimed.
