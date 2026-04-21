# Sub-agent report template

```text
Status: PASS / PARTIAL / BLOCKED
Package: CWP-XX
Branch:
Commit:
Worktree: clean / dirty / not verified

Summary:
- ...

Files changed:
- ...

Verified:
- ...

Targeted commands:
1. command:
   cwd:
   exit code:
   tests run:
   failures:
   errors:
   skipped:

DADS boundary:
- basis used:
- assertions added:
- deferred:

ORCA boundary:
- local persistence:
- static contract:
- live ORCA mutation performed: no
- 要 ORCA 公式仕様確認:

Not verified:
- Playwright/e2e:
- runtime browser:
- live ORCA:
- Phase 3/4:
- fullflow:

Artifact:
- path:
- SHA-256:
- contents checked:
```
