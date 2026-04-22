# Fullflow And Browser E2E Gap Matrix

RUN_ID: `20260422T134401Z`

| Area | Current status | Evidence source | Gap | Safe evidence approach | Required next tests |
|---|---|---|---|---|---|
| Runtime browser e2e status | NOT_RUN for Clinical Wave 1 docs reviewed here. | WO-3/WO-4 ORCA/runtime claims. | Runtime UI path not proven. | Run browser e2e with sanitized logs only; no screenshots/HAR/trace/video unless policy is explicitly changed. | Patient select, chart open, save, reload, edit/delete smoke. |
| Playwright or equivalent e2e | NOT_RUN in WO-3/WO-4. | WO-3/WO-4 final reports. | No Playwright-backed workflow proof. | Use text/JSON summaries, step status, hashes, and redacted classifications. | Core chart workflow e2e without live ORCA first. |
| Fullflow | NOT_RUN. | WO-3/4/5/6/7/8. | End-to-end chart entry through ORCA send not proven. | Run only after browser and live ORCA prerequisites; capture sanitized summary, not raw request/response. | Safe fullflow plan and execution. |
| Patient selection through ORCA send | NOT_VERIFIED. | Release validation says this is required future evidence. | Combined workflow evidence missing. | Stage no-live browser tests first, then live trial endpoint-by-endpoint. | RWO-02 through RWO-08. |
| Screenshot/HAR/trace/video restrictions | Prohibited by this task and evidence policy. | User policy, evidence sanitize policy. | Visual/raw network proof cannot be used here. | Use sanitized step logs, status classifications, command logs, and hash ledgers. | Define future safe evidence format before execution. |
| Raw network / request / response | Prohibited. | Evidence sanitize policy. | Cannot inspect raw ORCA bodies to fill gaps. | Endpoint-specific parsed success fields only, redacted and allowlisted. | Design safe evidence parser. |

## Required Before Release

1. Browser smoke for chart open, SOAP, disease, prescription, generic order, document save/reload, and failure recovery.
2. Prescription and generic order browser e2e persistence/readback.
3. Disease/SOAP browser e2e.
4. Owner-approved trial ORCA live verification for each needed endpoint.
5. Fullflow only after prior gates provide safe prerequisites.

