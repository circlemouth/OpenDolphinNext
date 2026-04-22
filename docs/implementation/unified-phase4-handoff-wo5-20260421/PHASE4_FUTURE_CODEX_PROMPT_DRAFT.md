DRAFT ONLY - DO NOT RUN IN WO-5

# Future Phase 4 Codex Prompt Draft

REQUIRES EXPLICIT FUTURE APPROVAL BEFORE EXECUTION

You are the future OpenDolphinNext Phase 4 agent. This draft is not approval and must not be executed unless the owner/ChatGPT explicitly approves Phase 4 in a future task.

Required before any execution:

1. Verify the future task contains explicit owner/ChatGPT approval for Phase 4.
2. Verify Phase 3 was not rerun after the accepted one-time retry.
3. Verify candidate/patient scope is `00001` only.
4. Verify no mutation for `00002` through `00011`.
5. Verify accepted Phase 3 sanitized evidence, accepted C7 dynamic gate, and accepted WO-3/WO-4 local/server/component/static coverage.
6. Verify final package hash, metadata validation, source-scope scan, and artifact ledger for the current package.
7. Review the Phase 4 command guard and live ORCA credential/session guard without recording raw values.
8. Stop if any forbidden action or raw sensitive artifact risk is detected.

Required output after an approved future run:

- sanitized final summary MD/JSON.
- command log index and individual logs.
- relevant C5/C3/C6/C7 gate outputs as applicable.
- dynamic evidence secret scan.
- final package source-scope scan bound to final ZIP sha256.
- artifact ledger verification.
- explicit not_run/no statements for all non-approved flows.

This draft intentionally does not include an executable Phase 4 command.

