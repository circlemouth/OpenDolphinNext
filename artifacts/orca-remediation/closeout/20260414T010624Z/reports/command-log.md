# Command Log

## Provenance

| Command / action | Result | Evidence |
| --- | --- | --- |
| `git status --short` | captured | `git/git-status-short.txt` |
| `git rev-parse HEAD` | `cd50269d3dae361a6ea879c3045ce49e6d11c8a9` | `git/git-head-current.txt` |
| `git branch --show-current` | `codex/orca-closeout-recovery-20260414T010624Z` | `git/git-branch-current.txt` |
| `git remote show origin` | captured | `git/git-remote-origin-current.txt` |
| `git merge-base HEAD origin/master` | `fecd6cde13a5a60441e5aeec9818afe09c9b52db` | `git/git-merge-base-origin-master.txt` |
| `git diff --stat origin/master...HEAD` | captured | `git/git-diff-stat.txt` |
| `git log --oneline origin/master..HEAD` | captured | `git/git-log-oneline.txt` |

## Validation Runs

| Command / action | Result | Evidence |
| --- | --- | --- |
| `cd web-client && npm run verify:web-guard` | PASS | worker run log |
| `cd web-client && npm run ci` | PASS | `tests/web-ci.log` |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaAppointmentResourceTest,OrcaXmlMapperTypedTextParsingTest,OrcaVisitResourceTest test` | PASS | worker run log |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaVisitResourceRealtimeTest,OrcaVisitResourceTest test` | PASS | worker run log |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | PASS | `tests/server-verify.log` |
| `node --test tests/review-packet/reviewer-submission-packet.test.mjs` | PASS (`5/5`) | worker run log |

## Runtime / ORCA Evidence

| Command / action | Result | Evidence |
| --- | --- | --- |
| direct upstream `system01lstv2` probe | PASS (`HTTP 200`, `Api_Result=00`) | `evidence/medical-information-probe/raw-request.xml`, `evidence/medical-information-probe/raw-response.xml`, `evidence/medical-information-probe/raw-response.headers` |
| app route `GET /api/orca/official/appointments/medical-information` | PASS (`HTTP 200`) | `evidence/medical-information-probe/probe-summary.json`, `evidence/medical-information-probe/route-response.json`, `evidence/medical-information-probe/server-stacktrace.log` |
| `/api/orca/official/patients/import` rerun | PASS (`HTTP 200`, `apiResult=00`) | `evidence/patients-import/import-summary.json`, `evidence/patients-import/request-meta.txt` |
| canonical refetch after import | PASS | `evidence/patients-import/canonical-refetch-response.json` |
| local search after import | PASS | `evidence/patients-import/local-search-response.json` |
| `RUN_ID=20260414T010624Z QA_PATIENT_ID=01424 node web-client/scripts/qa-acceptmodv2-weborca.mjs` | PASS with blocker capture (`apiResult=16`) | `qa/acceptmodv2/accept-summary.json`, `qa/acceptmodv2/steps.log` |
| `RUN_ID=20260414T010624Z QA_PATIENT_ID=01423 node web-client/scripts/qa-fullflow-weborca.mjs` | FAIL with blocker capture (`apiResult=16`, no request xml) | `qa/fullflow/summary.json`, `qa/fullflow/network/network.json`, `qa/fullflow/handoff-state.json`, `evidence/runtime-blockers/server-log-acceptmodv2-duplicates.log` |

## Packet

| Command / action | Result | Evidence |
| --- | --- | --- |
| `./scripts/create-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z --accepted-head cd50269d3dae361a6ea879c3045ce49e6d11c8a9` | PASS | `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z`, `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z.zip` |
| `./scripts/validate-reviewer-submission-packet.sh --run-id 20260414T010624Z --accepted-ref codex/orca-closeout-recovery-20260414T010624Z --accepted-head cd50269d3dae361a6ea879c3045ce49e6d11c8a9` | PASS | `artifacts/reviewer-submission-packets/submission-packet-20260414T010624Z` |

## Notes

- `appointments/medical-information` については、direct upstream probe と app route probe の両方が current RUN_ID で `200` を返しているため、old 502 を external blocker として再利用していない。
- live send は未到達のため、`medicalmodv2.xml` は current RUN_ID の command log に含めない。
- accepted HEAD は `cd50269d3dae361a6ea879c3045ce49e6d11c8a9` に固定し、packet create/validate でも `--accepted-head` を明示する。
