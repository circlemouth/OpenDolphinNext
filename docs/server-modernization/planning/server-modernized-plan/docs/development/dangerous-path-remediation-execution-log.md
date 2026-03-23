# dangerous path remediation execution log

## execution log

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T12:58:47Z
- patch_set: orchestration-start
- status: done
- summary: 危険経路修正の実行順を PS01 → PS08 に固定し、Patch Set ごとの担当サブエージェントを起動した。
- notes:
  - 正本チェックリストを通読済み。
  - baseline `mvn -q -pl server-modernized -am -DskipTests compile` は成功。

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T13:12:00Z
- patch_set: PS01
- status: done
- summary: 公開危険 route を public 登録から外し、公開 route 契約テストを更新した。
- notes:
  - `OpenDolphinRestApplication` から checklist 指定 7 resource を削除。
  - `WebXmlEndpointExposureTest`, `PublicRouteInventoryContractTest` を再実行して PASS。

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T13:27:40Z
- patch_set: PS02
- status: done
- summary: prod-like startup guard と safe-default を導入した。
- notes:
  - `DocumentIntegrityConfig` の permissive fallback を撤去。
  - `ServletStartup` に prod-like fail-fast を追加。
  - sample config から FIDO2 ブロックを削除。

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T13:27:40Z
- patch_set: PS03
- status: done
- summary: facility 未解決 ORCA call を fail-fast 化した。
- notes:
  - `RestOrcaTransport` の no-arg access を fail-fast 化。
  - `OrcaPatientSyncScheduler` の runtime facility fallback を削除。

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T13:31:39Z
- patch_set: PS04
- status: done
- summary: security/bootstrap 側の止血を適用した。
- notes:
  - `RequestSecuritySupport` と `AbstractResource` の forwarded trust gate を統一。
  - `AdminAccessPasswordResetResource` に再公開禁止コメントを追加。
  - `RepoGuardScriptsIT` に `InitialAccountMaker.class` 非同梱 smoke を追加。

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T13:39:37Z
- patch_set: PS05
- status: done
- summary: 2FA を TOTP-only に固定し FIDO2 runtime 依存を除去した。
- notes:
  - `requiresSecondFactor` を off/totp のみで判定。
  - verified TOTP credential 不在では second factor dead-end を作らないよう変更。
  - `Fido2Config` 削除と `pom.xml` から Yubico WebAuthn 依存除去。

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T13:55:00Z
- patch_set: PS06
- status: done
- summary: module/attachment/image 契約を external-only / bean_json 正本へ固定した。
- notes:
  - `V0302__module_payload_table.sql` を reserved/no-op 化し、module-payload scripts を削除。
  - `StoragePersistenceContractValidator` を追加し、`ServletStartup` から起動時検証を追加。
  - attachment/image inline fallback を撤去し、`uri + digest` 必須へ変更。
  - compile 時の `V0303` 欠落は transient failure と切り分け、再実行で解消。

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T14:00:00Z
- patch_set: PS07
- status: done
- summary: 残留 fallback を掃除し、必須回帰と grep 最終確認を完了した。
- notes:
  - `OrcaLocalMedicalOutpatientResource` の synthetic fallback を物理削除。
  - `OrcaDiseaseResource` の local disease fallback を fail-closed 化。
  - checklist 必須回帰セット `126 tests` は failures/errors 0。

### entry
- run_id: 20260323T125847Z
- timestamp_utc: 2026-03-23T14:05:00Z
- patch_set: PS08
- status: done
- summary: ステータス台帳・実行ログ・最終サマリを更新し、危険経路修正チェックリストを完了状態で閉じた。
- notes:
  - blocked 項目はなし。
  - 設計待ち項目は summary に分離記録。
