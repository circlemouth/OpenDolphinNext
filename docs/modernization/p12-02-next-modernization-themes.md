# P12-02 次段 modernization テーマ整理

- 日付: 2026-03-15
- RUN_ID: 20260315T010035Z
- タスク: P12-02（`codex_automation_workplan_revised.md` 基準）

## 前提
- 進捗判定の正本は `docs/server-modernization/planning/codex_automation_workplan_revised.md` とする。
- `P9-03` から `P12-01` までで、共有リスト構造見直し、巨大クラスの責務分割、旧設定経路の棚卸し、設定優先順位整理、生成物の repository hygiene を完了した。
- `docs/server-modernization/planning/server_modernization_wbs_detailed.md` と README には、`P9-03` / `P10-01` 以降の番号対応に不一致が残る。次段でも progress 判定は revised workplan を優先する。

## 次段で扱うべき大きいテーマ

### 1. 設定正本の一本化
- 根拠: `docs/modernization/p11-01-legacy-config-inventory.md`
- 根拠: `docs/modernization/p11-02-config-priority-matrix.md`
- 主対象:
  - `server-modernized/src/main/java/open/orca/rest/ORCAConnection.java`
  - `server-modernized/src/main/java/open/orca/rest/OrcaResource.java`
  - `server-modernized/src/main/java/open/dolphin/mbean/PvtService.java`
  - `server-modernized/src/main/java/open/dolphin/session/SessionMessageHandler.java`
  - `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncScheduler.java`
- 狙い:
  - ORCA 接続先や facilityId 解決を `custom.properties` 直読から切り離し、`OrcaConnectionConfigStore` と明示 env/system bootstrap に寄せる。
  - `ChartEventServiceBean` の `pvtlist.clear` のような legacy property 断片依存も、admin config または明示設定へ移す。
- 完了イメージ:
  - ORCA / facilityId 系の主要経路で `custom.properties` 依存が不要になる。

### 2. ファイル state と WildFly 固定パス fallback の縮退
- 根拠: `docs/modernization/p11-01-legacy-config-inventory.md`
- 根拠: `docs/modernization/p11-02-config-priority-matrix.md`
- 主対象:
  - `server-modernized/src/main/java/open/dolphin/system/license/FileLicenseRepository.java`
  - `server-modernized/src/main/java/open/dolphin/orca/support/PushEventDeduplicator.java`
  - `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java`
  - `server-modernized/src/main/java/open/dolphin/runtime/RuntimeConfigurationSupport.java`
- 狙い:
  - `license.properties` と `pushevent-cache.json` のようなローカル state を DB または明示 bootstrap へ寄せる。
  - attachment 設定の `/opt/jboss/config` 既定値を config dir abstraction 基準に寄せ、WildFly 固定パス依存を薄くする。
- 完了イメージ:
  - runtime state の正本が DB / env / config dir に整理され、`jboss.home.dir` 直下ファイルへ依存しない。

### 3. 文書と運用番号の整流化
- 根拠:
  - `docs/modernization/p9-03-revised-shared-list-structure-review.md`
  - `docs/server-modernization/planning/codex_automation_workplan_revised.md`
  - `docs/server-modernization/README.md`
- 狙い:
  - revised workplan のタスク番号と README / 参考 WBS の案内番号不一致を、progress 判定ルールを壊さずに整理する。
  - `server/server/target/classpath.txt` のような legacy 側追跡済み生成物は、`server/` 変更禁止ルールを守った別判断として切り分ける。
- 完了イメージ:
  - 人間レビュー時に、進捗正本と参考資料の読み分けで迷わない。

## 人間レビューで先に決めること
1. ORCA legacy 設定 (`custom.properties`) を read-only 互換なしで切るか。
2. attachment storage の正本を env/secret + config dir に固定するか、DB 化まで進めるか。
3. license / push dedupe の runtime state を `runtime_state_store` へ寄せるか、専用 table を切るか。
4. legacy `server/` 配下の追跡済み生成物を、別スレッドで整理してよいか。

## まとめ
- 次回の automation は、この文書の 1 と 2 を優先度順に扱う前提で、人間レビュー後に新しい workplan へ落とし込むのが妥当。
- progress 判定の正本は引き続き revised workplan とし、README / WBS は参考資料として整流する。
