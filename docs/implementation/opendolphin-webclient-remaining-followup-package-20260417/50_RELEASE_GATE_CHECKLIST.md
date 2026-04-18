# release gate checklist after residual follow-up

> Historical note: this 2026-04-17 checklist is planning history. `PASS` and `already closed` language below must not be read as current gate evidence. Current source of truth is `docs/implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md` plus current contracts/runbooks.

## still required
- [ ] Task 10 claim-send cache storage contract hardening completed
- [ ] Task 20 charts correction-note / setting-note follow-up completed
- [ ] `tests/charts/e2e-billing-correction-note.spec.ts` PASS
- [ ] `tests/reception/e2e-billing-correction-note.spec.ts` PASS
- [ ] `cd web-client && npm run ci` PASS after residual fixes
- [ ] runtime-ready-smoke rerun PASS in the current run
- [ ] manual QA completed
- [ ] ORCA live QA completed
- [ ] fixed premise drift check clean

## already closed and not to reopen by default
- [x] Reception transmission projection blocker
- [x] OrcaSummary mount contract blocker
- [x] print preview harness-first blocker
- [x] Task 31 print app-side escalation

## stop-ship rule
上の still required が 1 つでも未完了なら stop-ship を解除しない。
