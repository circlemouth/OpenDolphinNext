# Codex UI MVP Remediation 2026-05-21

- RUN_ID: `20260521T204535Z`
- Source plan: [mvp-ui-remediation-plan-20260521.md](../../docs/web-client/ux/mvp-ui-remediation-plan-20260521.md)
- Scope: `web-client/` MVP UI remediation for Auth, Reception, Charts, Patients, Mobile Images, and Administration.

## Safety Boundary

This package treats OpenDolphinNext as an EHR / ORCA-linked clinical system. UI changes must not lower the safety contract in `web-client/notes/ui-current-contract.md`, must not expose raw ORCA bodies, request IDs, trace IDs, RUN_ID, internal route names, feature flags, credentials, or patient-sensitive details in normal user UI, and must not restore patient context into URLs or browser storage.

## Subagent Prompts

- [01-foundation.md](subagent-prompts/01-foundation.md)
- [02-reception.md](subagent-prompts/02-reception.md)
- [03-charts.md](subagent-prompts/03-charts.md)
- [04-edge-surfaces.md](subagent-prompts/04-edge-surfaces.md)
- [05-validation-docs.md](subagent-prompts/05-validation-docs.md)

## Expected Final Outputs

- `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`
- `deliverables/codex-ui-mvp-20260521/validation-report.md`
- `deliverables/codex-ui-mvp-20260521.zip`

