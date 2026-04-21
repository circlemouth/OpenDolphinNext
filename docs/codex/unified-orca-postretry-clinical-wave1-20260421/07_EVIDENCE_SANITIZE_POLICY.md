# 07. Evidence and sanitize policy

## Hard exclusions

No package may include:

- raw credentials
- raw password
- credential-bearing URL
- cookies
- Authorization header values
- JSESSIONID
- CSRF token value
- raw session
- raw ORCA request body
- raw ORCA response body
- raw patient details
- raw insurance details
- HAR
- traces
- videos
- raw screenshots
- raw network dumps
- `.git`
- `node_modules`
- `dist`
- `target`
- `coverage`
- `test-results`
- raw artifact directories

## Acceptable sanitized evidence

- redacted labels such as `<<redacted>>`
- secret placeholders such as `<generated-runtime-secret>`
- hash ledgers
- command/cwd/runId/start/end/exit_code
- sanitized status/category fields
- patient IDs necessary for the gate, when allowed by prior evidence policy
- no names, addresses, birth dates, insurance bodies, or raw XML/JSON bodies

## Claim separation

Always separate:

- dynamic review evidence scan
- package source-scope scan
- full source scan
- worktree clean
- package metadata validation
- functional success evidence

Do not promote one kind of evidence into another.

Examples:

- package source scan passed != full source clean
- dynamic evidence secret scan passed != source clean
- worktree started clean != final worktree clean
- HTTP 200 != business success
- wrapper exit 0 != business success
- dry-run evidence != mutation success

## ORCA claims

- `apiResult=60` is diagnostic/no existing acceptance, not mutation success.
- `Request_Number=00` is inquiry/existing acceptance diagnostic, not registration success.
- `Request_Number=01` is the intended Phase 3 registration request number.
- `Request_Number=02/03/04` are forbidden for this Phase 3 retry success classification.
- `K1/K2/K3` may be acceptedWithWarnings only with registration evidence and C7 accepted.

## Clinical claims

Clinical Wave 1 may claim targeted local/server/component/static coverage only. It may not claim live ORCA success.
