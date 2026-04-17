# release gate checklist after blocker fixes

## still required
- [ ] correction-note spec verification completed
- [ ] `cd web-client && node scripts/runtime-ready-smoke.mjs` PASS
- [ ] `cd web-client && npm run ci` PASS
- [ ] `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` PASS
- [ ] manual QA completed
- [ ] ORCA live QA completed
- [ ] fixed premise drift check clean

## no longer required as blocker work
- [x] Reception transmission projection fix
- [x] OrcaSummary mount contract fix
- [x] Print preview harness-first isolation / fix
- [x] Task 31 app-side print escalation

## stop-ship rule
上の still required が 1 つでも未完了なら stop-ship を解除しない。
