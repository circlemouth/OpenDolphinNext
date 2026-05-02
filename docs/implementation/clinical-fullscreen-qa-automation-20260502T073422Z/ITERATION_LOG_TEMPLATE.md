# Iteration Log Template

このテンプレートを `artifacts/clinical-fullscreen-qa/<RUN_ID>/iteration-log.md` にコピーし、各30分回の sanitized summary として使う。

## Header

- RUN_ID:
- Started at:
- Finished at:
- Git head:
- Branch:
- Operator:
- Automation: `OpenDolphin 全業務画面QA反復`

## Scope This Iteration

| Scenario ID | Screen | Goal | Result | Classification |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Browser Findings

| Step | Visible UI / DOM State | Network Status Class | Console/Page Error Summary |
| --- | --- | --- | --- |
|  |  |  |  |

## Changes Made

| File | Change | Reason | Security Impact |
| --- | --- | --- | --- |
|  |  |  |  |

## Verification

| Command / Browser Scenario | Result | Notes |
| --- | --- | --- |
|  |  |  |

## Blockers

| Classification | Blocker | Evidence | Resume Condition |
| --- | --- | --- | --- |
|  |  |  |  |

## Sanitization Check

- [ ] No raw ORCA request/response body in tracked evidence.
- [ ] No Cookie, Authorization, JSESSIONID, CSRF, password, or credential-bearing URL in tracked evidence.
- [ ] No patient name, address, phone number, insurance detail, or raw sensitive ORCA detail in tracked evidence.
- [ ] No HAR, trace, video, screenshot, or raw network dump in tracked evidence.
- [ ] Health/readiness/error summaries do not expose host, port, URL, internal exception, stack trace, or secret path.

## Next Iteration

- Priority:
- Suggested command:
- Suggested browser path:
- Expected completion signal:
