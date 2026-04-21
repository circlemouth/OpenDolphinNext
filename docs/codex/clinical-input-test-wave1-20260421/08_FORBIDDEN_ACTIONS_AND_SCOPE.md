# Forbidden actions and scope guardrails

## Absolute prohibitions for Wave 1

Do not perform any of the following:

1. live ORCA mutation
2. live ORCA order registration
3. live ORCA disease mutation
4. live ORCA subjectives mutation
5. live ORCA document mutation
6. Phase 3
7. Phase 4
8. fullflow
9. reception registration mutation
10. trial-site mutation tests
11. external web lookup
12. ORCA official spec lookup from the web
13. production code fixes unless the coordinator explicitly creates a follow-up implementation package after test results
14. broad refactor not required for test addition
15. generated build artifact edits
16. inclusion of HAR, trace, video, screenshots, raw XML, raw network logs, credentials, cookies, tokens, or patient-identifying runtime data in review artifacts

## Permitted actions

The following are allowed:

- add unit tests
- add component tests
- add API contract tests
- add server integration tests
- add Playwright/MSW tests that use mocks only
- add static ORCA contract tests without live transport
- add test fixtures that are synthetic and non-sensitive
- add test utility code when necessary for tests
- run targeted test commands locally
- record sanitized command summaries
- produce blocker reports when implementation behavior is not yet testable or fails expected contract

## Production code policy

Wave 1 is a **test-first / evidence-first** package.

- If an existing implementation passes the new test, merge the test.
- If a failure is caused by a test bug, fix the test.
- If a failure is caused by production behavior, do not patch production code in this wave unless the coordinator explicitly re-scopes the work.
- If failing tests cannot be merged under repository policy, keep them in the subagent branch and document the exact failure, expected behavior, and unskip/merge condition.
- Do not hide a clinical safety failure by weakening assertions.

## Evidence vocabulary

Use these terms precisely:

- `source evidence`: implementation or test source exists
- `test evidence`: a test source exists, or a test command has run with a recorded result
- `runtime verified`: a command was executed and passed in the current worktree
- `MSW verified`: mock browser/API flow passed; not live ORCA
- `live ORCA verified`: prohibited in Wave 1; must remain not verified
- `not verified`: source or dynamic evidence is missing

## ORCA boundary wording

Allowed wording:

- local chart persistence verified
- local diagnosis persistence verified
- static medicalmodv2 payload contract verified
- MSW order-send UI flow verified
- ORCA live mutation not verified
- future ORCA official specification check required

Forbidden wording:

- ORCA order registration verified
- ORCA disease registration verified
- ORCA subjectives registration verified
- live ORCA success
- full source is clean
- clean checkout verified
- e2e passed, unless a command summary proves it
