# WO-7 Mac Environment Preflight Report

RUN_ID: `20260422T103126Z`

## Verdict

`macOS accepted`

## Scope Boundary

- Phase 4: `not_run`
- fullflow: `not_run`
- live ORCA connection test: `not_run`
- live ORCA mutation: `no`
- Phase 3 retry rerun: `no`
- Request_Number `02` / `03` / `04`: `not_run`

## Recorded Environment

| item | result |
|---|---|
| OS | macOS `26.3`, build `25D125` |
| kernel | Darwin `25.3.0`, `arm64` |
| pwd | `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient` |
| pwd classification | accepted Mac `/Users/...` path; not Windows native and not `/mnt/c` |
| shell | `/bin/bash` |
| bash | GNU bash `3.2.57(1)-release` |
| git | `2.50.1 (Apple Git-155)` |
| node | `v22.16.0` |
| npm | `10.9.2` |
| java | Temurin OpenJDK `21.0.8` for direct `java -version`; Maven reports Homebrew OpenJDK `25.0.1` runtime |
| maven | Apache Maven `3.9.11` |
| zip | Info-ZIP `3.0` with Apple modifications |
| unzip | UnZip `6.00` with Apple modifications |
| shasum | `/usr/bin/shasum`, version output `6.02` |
| gsha256sum | not installed / not required because `shasum -a 256` is available |

## Git State

| item | result |
|---|---|
| branch | `master` |
| HEAD | `fc4652f69aac0868336a9be27f7cd792d3fb29b0` |
| initial status before WO-7 docs | clean, observed before output directory creation |
| recorded preflight status | `?? docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/` |
| `core.autocrlf` | unset; not `true` |
| `core.eol` | unset |
| `.gitattributes` | shell/PowerShell/runtime scripts under `scripts/`, `ops/tools/`, `ops/shared/docker/`, `ops/modernized-server/docker/`, and `server-modernized/tools/ci/*.sh` are forced LF |
| `git ls-files --eol` | recorded first 120 rows; existing CRLF/mixed tracked files are present outside this WO-7 docs-only scope |

## LF Classification

`accepted_with_existing_repo_crlf_mixed_noted`

Rationale:

- Reject condition `core.autocrlf=true` is not present.
- Mac path and toolchain are stable.
- Script LF policy is present in `.gitattributes`.
- Existing CRLF/mixed tracked files are recorded as repository state; WO-7 does not modify production code or those files.
- Worktree clean is not claimed after WO-7 artifact creation.

## WO-6 ZIP Verification

| item | result |
|---|---|
| path | `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/review-package/OpenDolphin_WebClient-review-package-20260422T062052Z-WO6_phase4-execution-prompt.zip` |
| exists | yes |
| sha256 | `f69cca11a97cc9977f3917bf9d626d9403dfc86d5b8e67cd5324f6f5999e0515` |
| size | `19163831` bytes |
| count | `2437` files |

## Command Evidence

Required Mac preflight commands are recorded in:

- `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/command-log.jsonl`
- `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/command-logs/001-sw_vers.log` through `026-wo6_zip_count.log`

