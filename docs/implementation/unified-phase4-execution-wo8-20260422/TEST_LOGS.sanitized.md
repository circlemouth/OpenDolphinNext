# WO-8 Test Logs Sanitized

## Command Summaries

- `git rev-parse --show-toplevel`: confirmed actual Codex repository root.
- `git branch --show-current`: `master`.
- `git rev-parse HEAD`: `ab5b173712741427c9eb8b0d022abc76857e6700`; expected HEAD mismatch accepted by latest owner instruction.
- `git status --short`: safe at gate check.
- macOS/tooling commands: macOS 26.3, Darwin arm64, bash 3.2, git 2.50.1, node 22.16.0, npm 10.9.2, Java/Maven/zip/unzip/shasum recorded.
- `git ls-files --eol | sed -n '1,120p'`: recorded existing LF/CRLF/mixed classification sample.
- WO-6 ZIP hash/size/count: matched expected `f69cca11a97cc9977f3917bf9d626d9403dfc86d5b8e67cd5324f6f5999e0515`, `19,163,831 bytes`, `2,437 files`.
- WO-7 ZIP hash/size/count: matched expected `7d73c32e6f34a9b60ccbcccfd005f3dcc2a14fecceee83af93152427535fa3e6`, `90,659 bytes`, `48 files`.
- WO-7 zero-candidate/harness readiness: `resolved_by_existing_local_evidence`, not official ORCA patient absence.
- Gate 6 harness review: blocked because no exact approved Phase 4 wrapper/action is defined and candidate fullflow harness creates forbidden artifacts.

## Execution Summary

- live ORCA action: not_run
- token consumed: no
- live ORCA mutation: no
- business success: not_evaluated_no_live_action
- forbidden raw data: none recorded
