# Phase2 Checklist Closeout

## 何を削除したか
- `PVTResource` と raw PVT public exposure を削除した。
- `/karte/document/pvt/{params}` の document save + encounter transition 複合 route を削除した。
- `OrcaPushSeenEventStore` / `OrcaPushStateStore` / `OrcaWrapperService` / `BackupCodeGenerator` など、phase2 checklist で禁止された legacy helper と stopgap を削除した。
- `PVTServiceBeanSupport` と legacy merge 前提の public contract を削除した。

## 何を rename したか
- `OrcaWrapperService` を `OrcaLiveGateway` へ rename した。
- `OrcaPushStateStore` を `OrcaPushConnectionStateStore` へ rename した。
- trusted proxy config key を `security.trusted-proxies` / `SECURITY_TRUSTED_PROXIES` へ統一した。

## 何を意図的に触っていないか
- `client/` と `server/` の legacy 実装は触っていない。
- ORCA upstream replay/cursor の strict recovery 完全実装は、repo 内 contract evidence が未確定のため bootstrap skeleton に留めた。
- report signing / TSA failure policy と break-glass route は checklist の着手禁止に従って未実装のまま維持した。

## 閉じた checkbox
- CT-01 から CT-11、および CT-H01 から CT-H04 を完了した。
- Done 定義の `仕様 / test / grep / generated artifact / docs-sync / public exposure / PR summary` をすべて満たした。
