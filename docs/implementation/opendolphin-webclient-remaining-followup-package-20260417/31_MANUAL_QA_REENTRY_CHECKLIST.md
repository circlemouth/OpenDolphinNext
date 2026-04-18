# manual QA re-entry checklist

> Historical note: this 2026-04-17 checklist records required re-entry conditions, not current evidence. Use the 2026-04-18 static exit report for accepted static status; manual QA was not run there.

- [ ] `tests/charts/e2e-billing-correction-note.spec.ts` PASS
- [ ] `tests/reception/e2e-billing-correction-note.spec.ts` PASS
- [ ] claim-send cache storage contract aligned (`invoiceNumber` / `medicalWarnings` not persisted)
- [ ] `cd web-client && npm run ci` PASS after residual fixes
- [ ] runtime-ready-smoke rerun PASS in the current run
- [ ] correction note と setting note が separate slot / separate tone で visible
- [ ] correction note / setting note が details 展開前提になっていない
- [ ] `send success != paid` drift なし
- [ ] fixed premise drift なし
