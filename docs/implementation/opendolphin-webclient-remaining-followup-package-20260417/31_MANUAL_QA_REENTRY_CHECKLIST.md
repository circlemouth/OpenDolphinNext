# manual QA re-entry checklist

- [ ] `tests/charts/e2e-billing-correction-note.spec.ts` PASS
- [ ] `tests/reception/e2e-billing-correction-note.spec.ts` PASS
- [ ] claim-send cache storage contract aligned (`invoiceNumber` / `medicalWarnings` not persisted)
- [ ] `cd web-client && npm run ci` PASS after residual fixes
- [ ] runtime-ready-smoke rerun PASS, or carry-forward reason documented with no touched dependency
- [ ] correction note と setting note が separate slot / separate tone で visible
- [ ] correction note / setting note が details 展開前提になっていない
- [ ] `send success != paid` drift なし
- [ ] fixed premise drift なし
