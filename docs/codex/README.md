# Codex Development Docsets

`docs/codex/` は Codex coordinator / subagent 向けの開発 docset を置く領域です。
current contract や release gate の正本ではなく、実装 wave の scope、prompt、acceptance、結果報告の導線を保持します。

## Active / Next
- [unified-orca-postretry-clinical-wave1-20260421/README.md](unified-orca-postretry-clinical-wave1-20260421/README.md): ORCA Trial Phase 3 post-retry hardening と Clinical Input Wave 1 を Work Order 単位で進める統合 coordinator docset。初期実行は WO-0 + WO-1 に限定する。
- [clinical-input-cwp01-karte-order-persistence-20260421/README.md](clinical-input-cwp01-karte-order-persistence-20260421/README.md): CWP-01 karte/order local persistence evidence skeleton. This explicitly separates local chart/document persistence tests from ORCA `medicalmodv2` live mutation success.
- [clinical-input-wave2a-20260421/README.md](clinical-input-wave2a-20260421/README.md): Wave 1 の clinical input high-severity blocker を production implementation change と targeted test update で解消する Wave 2A docset。

## Completed / Prior Context
- [clinical-input-test-wave1-20260421/README.md](clinical-input-test-wave1-20260421/README.md): clinical input test Wave 1 の coordinator / subagent docset と結果報告。

## Boundary
- 正本 contract は `docs/contracts/` と `web-client/notes/` を参照する。
- release / validation の実行手順は `docs/runbooks/` と `docs/releases/` を参照する。
- 実行結果や generated evidence は `artifacts/` に置き、この領域へ混在させない。
