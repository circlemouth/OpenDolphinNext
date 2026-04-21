# Test command and evidence policy

## Command discovery

Do not assume the package manager or test command. First inspect:

```text
package.json
web-client/package.json
server-modernized/pom.xml
api-contract/pom.xml
playwright.config.ts
.github/workflows/e2e.yml
```

Then choose the smallest targeted command that runs the new tests.

Examples below are illustrative only and must be adjusted to the actual repository scripts:

```bash
# Web client unit/component tests, if package scripts support it
cd web-client
npm run test -- --run src/features/charts/__tests__/TARGET.test.tsx

# Root Playwright tests, if scripts support it
npm run e2e -- tests/charts/TARGET.spec.ts

# Server targeted Maven tests, if module layout supports it
cd server-modernized
mvn -Dtest=TargetTest test
```

If command discovery is ambiguous, stop and report the ambiguity rather than inventing a broad command.

## Required evidence for each subagent

Each subagent must provide a final report containing:

```text
agent id:
worktree path:
branch name:
base commit:
changed files:
new tests added:
commands run:
  - command:
    cwd:
    result: PASS / FAIL / NOT RUN
    exit code:
    key output summary:
not run commands and reason:
failures / blockers:
forbidden-action attestation:
ORCA boundary statement:
merge recommendation:
```

## Sanitized evidence rules

Allowed in report:

- command line
- current working directory relative to repository root
- timestamp
- exit code
- test file names
- test names
- pass/fail counts
- short failure summary with synthetic data only

Not allowed in report:

- raw HAR
- raw trace
- raw video
- raw screenshot
- raw network body
- raw ORCA XML
- credentials
- cookies
- tokens
- real patient data
- full runtime environment dump

## Dynamic evidence semantics

A passing local test command proves only that command in that worktree.

Do not extrapolate:

- A passing server unit test does not prove browser runtime success.
- A passing MSW Playwright test does not prove live ORCA success.
- A passing package source-scope secret scan does not prove full source cleanliness.
- A passing test in one subagent worktree does not prove another unmerged worktree still passes.

The coordinator must re-run an aggregate targeted suite after merging subagent branches.
