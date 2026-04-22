# Phase 4 Forbidden Actions

Copy this block into any future Phase 4 prompt unless a later owner/ChatGPT instruction explicitly supersedes it.

```text
Forbidden actions:
- Do not run Phase 4 without explicit future owner/ChatGPT approval.
- Do not rerun Phase 3.
- Do not run fullflow unless explicitly approved in that future task.
- Do not run live ORCA mutation except the exact approved Phase 4 action.
- Do not mutate candidates/patients 00002 through 00011.
- Do not replay old mutation artifacts.
- Do not execute Request_Number 02, 03, or 04.
- Do not capture raw ORCA request bodies.
- Do not capture raw ORCA response bodies.
- Do not capture raw patient details.
- Do not capture raw insurance details.
- Do not capture raw credentials, cookies, Authorization headers, JSESSIONID values, CSRF token values, raw passwords, raw sessions, or credential-bearing URLs.
- Do not include HAR, trace, video, screenshot, or raw network dump artifacts.
- Do not treat not_run, not_verified, owner-waived, HTTP 200, wrapper exit 0, dry-run, precheck, local tests, server tests, component tests, static tests, or package scans as live ORCA business success.
```

If a command, script, or review step conflicts with this block, stop before execution and report the conflict.

