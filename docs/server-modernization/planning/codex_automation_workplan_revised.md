# Server Modernization Automation Workplan Revised

## 目的
この文書は、server modernization の進捗判定と次作業決定の第一正本である。  
`docs/server-modernization/planning/server_modernization_wbs_detailed.md` は参考資料として扱い、
未完了タスクの探索、完了判定、次タスク決定は、この文書を最優先に行う。

## 対象
- `common`
- `server-modernized`

## 進捗判定ルール
- この文書のチェック状態を進捗判定の第一基準とする
- `server_modernization_wbs_detailed.md` の全チェック状態は、完了判定の根拠にしない
- 両文書が矛盾する場合は、この文書を優先する
- blocker が出た場合は、その時点で停止し、新規タスクへ進まない
- 各タスクは GPT 5.4 high で 2 時間以内に終わる粒度に保つ
- 1 実行あたり、開始から 100 分を超えたら新規タスクへ着手しない
- 120 分以内に打ち切る
- 先頭タスクを完了し、blocker がなく、開始から 100 分未満で、次タスクの必要ファイルと確認方法を特定できるなら、次タスクへ進むことを原則とする
- 特に 20 分以上の余力が残る場合は、次タスクへ進まない理由を実行結果へ明記しない限り停止してはならない

## 共通制約
- `target/` 配下は編集しない
- ビルド成果物、zip 展開ゴミ、`__MACOSX` は対象外
- `tools/flyway/sql` を migration の正本とする
- `src/main/resources/db/migration` は必要に応じて同期する
- source のないモジュールに変更が波及したら停止する
- 後方互換性は考慮しない
- 旧互換実装を温存するための追加実装はしない
- ただし、明示的に据え置きとした範囲は勝手に触らない

## blocker 発生時の記載ルール
blocker が出た場合は、該当タスクの下に必ず次の 4 点を追記する。

- blocker の内容
- 根拠となるファイルまたは不足情報
- その場で止める理由
- 人間が次に判断すべきこと

---

## D. 文書と自動実行の整備

### [x] D-01 進捗正本を revised workplan に固定する
- 対象:
  - `docs/server-modernization/planning/codex_automation_master_prompt.md`
  - `docs/server-modernization/planning/codex_automation_workplan_revised.md`
  - `docs/server-modernization/planning/codex_automation_prompts_revised.md`
- 作業:
  - 進捗判定の第一正本を `codex_automation_workplan_revised.md` に統一する
  - `server_modernization_wbs_detailed.md` は参考資料扱いに下げる
- 完了条件:
  - 3 文書で優先順位が矛盾していない
- 成果:
  - automation が WBS 全チェック済みでも停止しない
- 次:
  - P1-01 へ進む

### [x] D-02 blocker 停止条件を 3 文書で統一する
- 対象:
  - 上記 3 文書
- 作業:
  - source 不足、target 編集必要、仕様未確定、migration 不整合、変更範囲外テスト失敗時に停止するルールを統一する
- 完了条件:
  - blocker 条件の表現が文書間でそろっている
- 成果:
  - 自動実行が危険な推測で進まない
- 次:
  - P1-01 へ進む

---

## P1. 変更前の足場づくり

### [x] P1-01 ホットパス改善対象の最小確認テストを追加する
- 対象:
  - ORCA transport
  - Chart event history purge
  - PVT 初期化 / 追加
  - `/docinfo/all`
  - 全患者取得 API
- 作業:
  - 既存の近傍テストを調べる
  - 変更前の最小確認に必要な契約テストまたは単体テストを追加する
  - 追加範囲は変更対象の安全確認に必要な最小限にとどめる
- 主な候補ファイル:
  - `server-modernized/src/test/java/open/dolphin/rest/...`
  - `server-modernized/src/test/java/open/dolphin/orca/...`
  - `server-modernized/src/test/java/open/dolphin/storage/...`
- 完了条件:
  - 次タスク以降で触る経路に対して、最低限の再確認ポイントがある
- blocker:
  - 対象コードの source が不足していて、変更前確認が置けない
- 2026-03-14 (RUN_ID=20260313T150054Z):
  - `server-modernized/src/test/java/open/dolphin/orca/transport/RestOrcaTransportTest.java` を追加し、admin config からの設定解決、default/facility 別の `HttpClient` 再利用、Basic 認証ヘッダー生成を固定した
  - `server-modernized/src/test/java/open/dolphin/rest/ChartEventSseSupportTest.java` に、履歴保存失敗時でも SSE 配信を継続し、クライアントへ replay gap を通知する最小確認を追加した
- 次:
  - P1-02

### [x] P1-02 migration 正本と反映先の整合ルールを明文化する
- 対象:
  - `tools/flyway/sql`
  - `src/main/resources/db/migration`
  - 本文書
- 作業:
  - migration の正本が `tools/flyway/sql` であることを記載する
  - 同期が必要な場合の運用を文書に 1 箇所で明文化する
- 完了条件:
  - DB 変更タスクで参照先がぶれない
- 2026-03-14 (RUN_ID=20260313T160056Z):
  - `tools/flyway/sql` を作成し、versioned migration (`V0300`〜`V0304`) を `server-modernized/src/main/resources/db/migration` から同期した
  - `docs/server-modernization/README.md` に、`tools/flyway/sql` を正本、`server-modernized/src/main/resources/db/migration` を反映先として扱う運用を追記した
  - `P1_03__minimal_baseline_seed.sql` は versioned migration 正本ではなく、手動 seed として据え置く扱いを明記した
- 次:
  - P2-01

---

## P2. ORCA transport の接続再利用改善

### [x] P2-01 RestOrcaTransport の設定キャッシュと HttpClient 寿命を分離する
- 対象:
  - `server-modernized/src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`
  - `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaHttpClient.java`
  - 関連設定クラス
- 作業:
  - 設定キャッシュの寿命と `HttpClient` / `OrcaHttpClient` の寿命を分離する
  - 30 秒経過ごとの client 再作成をやめる方向で整理する
  - 設定に変化がない限り client を再利用する形へ寄せる
- 完了条件:
  - 設定リフレッシュと client 再作成が同一条件で結びついていない
- テスト:
  - 再利用と設定変更時の差し替えを確認する最小テスト
- 2026-03-14 (RUN_ID=20260313T160056Z):
  - `RestOrcaTransport` の cache refresh を、設定再読込と `HttpClient` 再生成で分離した
  - TTL 経過や `reloadSettings()` 実行時でも、設定 fingerprint が不変なら既存 `HttpClient` / `OrcaHttpClient` を維持する構成へ変更した
- 次:
  - P2-02

### [x] P2-02 設定変更時だけ transport を差し替える fingerprint 判定を入れる
- 対象:
  - `RestOrcaTransport`
  - 関連設定 DTO / repository
- 作業:
  - 設定項目から fingerprint を作り、差分があるときだけ client を差し替える
  - 無変更時は既存 client を維持する
- 完了条件:
  - 無変更 refresh で `HttpClient` が再生成されない
- 2026-03-14 (RUN_ID=20260313T160056Z):
  - `OrcaTransportSettings` に cache fingerprint を追加し、admin config の TLS 資材も含めた transport fingerprint を `RestOrcaTransport` 側で計算するようにした
  - fingerprint が変わった場合のみ transport entry を差し替え、無変更時は loadedAt のみ更新する形へ整理した
- 次:
  - P2-03

### [x] P2-03 ORCA transport の再利用確認テストを追加する
- 対象:
  - ORCA transport 周辺テスト
- 作業:
  - 同一設定で client が再利用されること
  - 設定変更時のみ差し替わること
  - 既存契約を壊していないこと
- 完了条件:
  - ORCA transport の変更に対する安全網がある
- 2026-03-14 (RUN_ID=20260313T160056Z):
  - `server-modernized/src/test/java/open/dolphin/orca/transport/RestOrcaTransportTest.java` に、無変更 refresh で同一 `HttpClient` を再利用するテストと、設定変更時のみ差し替わるテストを追加した
  - 既存の admin config 解決 / facility 別解決 / Basic 認証ヘッダー生成テストを維持し、既存契約を壊していないことを再確認した
- 次:
  - P3-01

---

## P3. ChartEventHistory purge の経路分離

### [x] P3-01 SSE 配信経路から purge 呼び出しを外す
- 対象:
  - `server-modernized/src/main/java/open/dolphin/rest/ChartEventSseSupport.java`
  - `server-modernized/src/main/java/open/dolphin/rest/ChartEventHistoryRepositoryImpl.java`
  - 関連 service
- 作業:
  - 配信時に毎回 `purge` しない構成へ変える
  - `save` と `purge` を同一ホットパスに置かない
- 完了条件:
  - イベント配信メソッドから purge が直接呼ばれない
- 2026-03-14 (RUN_ID=20260313T220553Z):
  - `ChartEventSseSupport.broadcast()` から `historyRepository.purge(...)` を削除し、配信ホットパスでは履歴保存のみ行う構成へ変更した
  - 本タスク記載の対象パスが `open/dolphin/chart/...` になっていたが、実コードは `open/dolphin/rest/...` 配下だったため、工程表の記載も実体に合わせて補正した
- 次:
  - P3-02

### [x] P3-02 purge を定期メンテナンス経路へ移す
- 対象:
  - chart event history 周辺 service / scheduler
- 作業:
  - purge を定期ジョブまたは明示メンテナンス経路へ移す
  - purge 失敗時に配信本体へ影響しない構成にする
- 完了条件:
  - purge 実行が配信レイテンシに直結しない
- 2026-03-14 (RUN_ID=20260313T220553Z):
  - `ChartEventHistoryMaintenanceService` を追加し、保持件数・保持時間の設定を読んで `ChartEventHistoryRepository.purgeAll(...)` を呼ぶ定期メンテナンス経路を新設した
  - `ChartEventHistoryPurgeScheduler` を追加し、既定 5 分間隔で purge を実行する構成へ移した。purge 失敗は scheduler 側で握り、SSE 配信本体へ波及しない
  - `ChartEventHistoryRepositoryImpl` に facility 横断の `purgeAll(...)` を追加し、古い履歴の削除と施設単位 retention count の刈り込みをまとめて実行できるようにした
- 次:
  - P3-03

### [x] P3-03 履歴保持の挙動確認テストを追加する
- 対象:
  - chart event history 周辺テスト
- 作業:
  - 保存は続くこと
  - purge が別経路で動くこと
  - 配信経路が purge に依存しないことを確認する
- 完了条件:
  - 分離後の意図がテストで確認できる
- 2026-03-14 (RUN_ID=20260313T220553Z):
  - `ChartEventSseSupportTest` に、配信時に履歴保存は続くが purge は呼ばれないことを固定した
  - `ChartEventHistoryMaintenanceServiceTest` を追加し、保持設定に応じて purgeAll を呼ぶ経路と、保持無効時に何もしない経路を確認した
  - `ChartEventHistoryRepositoryImplTest` に、facility 横断 purgeAll が保持時間削除と facility 単位 retention count 刈り込みを実行することを追加した
- 次:
  - P4-01

---

## P4. 受付ホットパスの DB 往復削減

### [x] P4-01 initializePvtList の問い合わせ構造を棚卸しする
- 対象:
  - `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java`
  - `server-modernized/src/main/java/open/dolphin/session/PVTServiceBean.java`
  - 関連 repository / DAO
- 作業:
  - 当日一覧初期化時に患者ごと追加参照している箇所を洗い出す
  - join 可能箇所、一括取得可能箇所、Java 側集計箇所を分ける
- 完了条件:
  - 次タスクで減らす対象問い合わせが明確である
- 2026-03-14 (RUN_ID=20260313T230105Z):
  - `ChartEventServiceBean.initializePvtList()` は、当日 PVT 一覧 1 回取得の後、患者ごとに `HealthInsuranceModel` / `KarteBean` / `AppointmentModel` / `RegisteredDiagnosisModel` を順に再読込しており、明示クエリだけで `1 + 4N` 往復になると整理した
  - `PVTServiceBean.addPvt()` は、既存患者経路で `PatientModel` 検索と保険再読込を行い、当日受付ではさらに `KarteBean` ID 取得、当日予約取得、病名数取得に加えて `eventServiceBean.getPvtList(fid)` の全走査で重複確認していることを確認した
  - P4-02 の変更対象は `ChartEventServiceBean.initializePvtList()` に限定し、患者 ID 単位の保険一括取得、カルテ一括取得、カルテ ID 単位の予約一括取得、病名一覧一括取得 + Java 側集計へ寄せる方針を確定した
  - P4-03 で継続確認すべき対象を `PVTServiceBean.addPvt()` / `ServletContextHolder` 上の `pvtList` 重複走査 / `PatientModel(facilityId, patientId)` 一意制約周辺に絞った
- 次:
  - P4-02

### [x] P4-02 initializePvtList を join または一括取得寄りにする
- 対象:
  - `ChartEventServiceBean`
  - 関連 repository / query
- 作業:
  - 保険、カルテ、予約、病名数などの取得を可能な範囲でまとめる
  - Java 側での不要な再集計を減らす
- 完了条件:
  - 初期一覧構築時の患者ごとの追加問い合わせ数が減る
- テスト:
  - 一覧の内容が既存契約から外れていないこと
- 2026-03-14 (RUN_ID=20260313T230105Z):
  - `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java` の `initializePvtList()` を、PVT 一覧取得後に患者 ID / カルテ ID を集約し、保険・カルテ・予約・病名をそれぞれ 1 回ずつ一括取得する構成へ変更した
  - 病名数計算は `setByomeiCount(...)` の判定ロジックを `applyByomeiCount(...)` に寄せ、初期一覧では一括取得済みの `RegisteredDiagnosisModel` 群を再利用するよう整理した
  - `server-modernized/src/test/java/open/dolphin/session/ChartEventServiceBeanInitializationTest.java` に、複数 PVT 初期化時でも関連問い合わせを患者単位で繰り返さず、予約名・病名数・保険情報が従来どおり埋まることを確認するテストを追加した
- 次:
  - P4-03

### [x] P4-03 addPvt の重複確認と登録を idempotent に寄せる
- 対象:
  - `PVTServiceBean.addPvt()`
  - 関連 entity / repository / DB 制約
- 作業:
  - 業務キー候補を確認する
  - メモリ走査前提の重複確認を、DB 側の一意性または業務キー前提へ寄せる
  - 既存患者確認、保険確認、予約取得の順序を見直す
- 完了条件:
  - 重複防止の主軸がメモリ全走査ではなくなる
- blocker:
  - 業務キーが文書化されておらず、コードからも合理的に確定できない
- 2026-03-14 (RUN_ID=20260314T000119Z):
  - `server-modernized/src/main/java/open/dolphin/session/PVTServiceBean.java` の当日受付重複判定を、`ServletContextHolder` 上の `pvtList` 全走査から `facilityId + patientId + 正規化済み pvtDate + 未キャンセル` を使う DB 問い合わせへ変更した
  - 重複時は DB 上の既存 PVT を主キーに merge し、メモリ上の `pvtList` は通知前の反映先だけに縮小した
  - 予定カルテ経路の既存日次重複処理は据え置き、今回の変更範囲を当日受付ホットパスに限定した
- 次:
  - P4-04

### [x] P4-04 addPvt 周辺の安全確認テストを追加する
- 対象:
  - PVT 周辺テスト
- 作業:
  - 正常追加
  - 重複追加
  - 業務キー重複時の扱い
- 完了条件:
  - 受付追加ホットパスの最低限の安全網がある
- 2026-03-14 (RUN_ID=20260314T000119Z):
  - `server-modernized/src/test/java/open/dolphin/session/PVTServiceBeanAddPvtTest.java` を追加し、正常追加、当日重複時の merge、患者登録のみ（`pvtDate == null`）を確認した
  - 重複追加テストでは cache を空にした状態でも DB 側の重複判定で merge できることを固定した
- 次:
  - P5-01

---

## P5. 全件返却 API のページング前提化

### [x] P5-01 `/docinfo/all` の契約を棚卸しし、ページング案を文書化する
- 対象:
  - `server-modernized/src/main/java/open/dolphin/rest/KarteResource.java`
  - `server-modernized/src/main/java/open/dolphin/session/KarteServiceBean.java`
  - 関連テスト
- 作業:
  - 既存レスポンス構造を確認する
  - 一覧と本文・添付の境界を整理する
  - ページング導入後も残すべき項目を明文化する
- 完了条件:
  - 次タスクで実装する契約が確定している
- 2026-03-14 (RUN_ID=20260314T000119Z):
  - `docs/modernization/p5-01-docinfo-all-contract-inventory.md` を追加し、現行 `/karte/docinfo/all/{patientPk}` が `DocumentLoadMode.ATTACHMENT_LIGHT` で `modules` 非同梱・`attachment.contentBytes == null`・`schema.imageBytes` 同梱になっていることを整理した
  - `KarteServiceBeanGetDocumentsBulkFetchTest` を根拠に、現行 light load で保証されている点と `/docinfo/all` 専用 contract test 不足を記録した
  - `web-client` からの現行参照は見つからず、legacy client の PDF 一括出力だけが旧契約を期待しているが、server-modernized 実装とは既に一致していないことを記録した
  - P5-02 の契約案を `offset/limit` 追加、`limit` 既定 50 / 最大 200、`schema.imageBytes` と `attachment.contentBytes` を一覧から除外する方針で固定した
- 次:
  - P5-02

### [x] P5-02 `/docinfo/all` をページング前提に変更する
- 対象:
  - `KarteResource`
  - `KarteServiceBean`
  - 関連 DTO / contract test
- 作業:
  - offset / limit または page / size を導入する
  - 一覧取得時に本文や重い付随情報を必要最小限にする
- 完了条件:
  - 全件一括返却が必須でない経路になっている
- テスト:
  - ページ境界
  - デフォルト件数
  - 既存利用箇所の最低限確認
- 2026-03-14 (RUN_ID=20260314T010119Z):
  - `server-modernized/src/main/java/open/dolphin/rest/KarteResource.java` の `GET /karte/docinfo/all/{patientPk}` に `offset` / `limit` query parameter を追加し、既定 `limit=50` / 最大 `200` へ正規化するよう変更した
  - `server-modernized/src/main/java/open/dolphin/session/KarteServiceBean.java` の `getAllDocument(...)` を overload し、文書 ID 取得 query に `setFirstResult` / `setMaxResults` を適用したうえで、一覧取得を `DocumentLoadMode.REVISION_LIGHT` へ切り替えて `schema.imageBytes` と `attachment.contentBytes` を同梱しないよう整理した
  - `server-modernized/src/test/java/open/dolphin/session/KarteServiceBeanGetDocumentsBulkFetchTest.java` に、ページ境界適用と binary 非同梱を確認するテストを追加し、`server-modernized/src/test/java/open/dolphin/rest/KarteResourceDocinfoAllPagingTest.java` で既定件数と limit clamp を固定した
- 次:
  - P5-03

### [x] P5-03 全患者取得 API をページング前提へ変更する
- 対象:
  - `PatientServiceBean`
  - 関連 resource / test
- 作業:
  - ページングなし全取得経路を見直す
  - 画面用途ごとに必要件数を制限する
- 完了条件:
  - 無制限全件返却 API が主要経路から外れている
- 2026-03-14 (RUN_ID=20260314T060116Z):
  - `server-modernized/src/main/java/open/dolphin/session/PatientServiceBean.java` の `getAllPatient(String fid)` を既定 200 件のページング前提へ変更し、`offset` / `limit` 付き overload と正規化関数を追加した
  - 全患者取得 query を `order by p.patientId, p.id` の安定順へ固定し、`limit` は最大 500 件に clamp するよう整理した
  - `server-modernized/src/test/java/open/dolphin/session/PatientServiceBeanGetAllPatientPagingTest.java` を追加し、既定件数・limit clamp・保険情報付与を確認した
  - 矛盾メモ: `docs/server-modernization/server-api-inventory.md` / `docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md` には legacy `/patient/all` が残っているが、実コードの `server-modernized` では `PatientResource` は未公開で、`WebXmlEndpointExposureTest` も非公開前提になっていた。進捗判定と実装判断は実コードを優先した
- 次:
  - P6-01

---

## P6. byte 配列偏重の削減

### [x] P6-01 AttachmentStorageManager のホット経路を stream ベースへ寄せる
- 対象:
  - `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`
- 作業:
  - 読み込み、書き込みのうち hot path を特定する
  - `byte[]` 全載せを減らせる経路から stream 化する
  - 既存メソッド契約を壊さずに内部実装を改善する
- 完了条件:
  - ホット経路の主要メソッドで `byte[]` 全載せが避けられている
- 2026-03-14 (RUN_ID=20260314T061008Z):
  - `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java` に、stream payload を S3 へ事前外部化し、rollback hook まで登録する `prepareExternalAssetForPersist(...)` を追加した
  - `server-modernized/src/main/java/open/dolphin/session/PatientImageServiceBean.java` の patient image upload 経路を更新し、S3 モードでは `AttachmentModel.contentBytes` を積まずに stream upload を先行させ、persist 時点では `uri` / `digest` / `contentSize` のみを保持する構成へ寄せた
  - DB モードでは従来どおり inline `contentBytes` を保持するため、公開契約は据え置いた
  - `server-modernized/src/test/java/open/dolphin/storage/attachment/AttachmentStorageManagerTest.java` と `server-modernized/src/test/java/open/dolphin/session/PatientImageServiceBeanTest.java` を更新し、stream upload・rollback hook・S3 pre-persist 経路を確認した
- 次:
  - P6-02

### [x] P6-02 患者画像レスポンスを stream 寄りに整理する
- 対象:
  - `server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java`
  - 画像関連 service
- 作業:
  - 丸ごと `byte[]` 化して返す経路を見直す
  - 可能ならストリームまたは chunk 寄りに整理する
- 完了条件:
  - 画像返却の主要経路で不要な全載せが減っている
- 2026-03-14 (RUN_ID=20260314T070048Z):
  - `server-modernized/src/main/java/open/dolphin/session/PatientImageServiceBean.java` の download 取得を、`AttachmentModel` entity そのものではなく `id/fileName/contentType/contentSize/uri/digest` だけを返す `DownloadHandle` projection へ変更した
  - `server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java` は `DownloadHandle` から stream 用の最小 `AttachmentModel` を組み立てる構成へ寄せ、download 時の不要な document/entity 参照を resource 境界へ持ち上げないよう整理した
  - `server-modernized/src/test/java/open/dolphin/session/PatientImageServiceBeanTest.java` と `server-modernized/src/test/java/open/dolphin/rest/PatientImagesResourceTest.java` を更新し、metadata projection と streaming download の回帰を確認した
- 次:
  - P6-03

### [x] P6-03 外部マスタ取得のバイナリ処理を stream ベースへ寄せる
- 対象:
  - `MasterUpdateService`
  - 関連 downloader / parser
- 作業:
  - 外部取得時のメモリ全載せ経路を確認し、stream で扱える範囲を整理する
- 完了条件:
  - 大きい外部データ取得時の一括メモリ保持が減っている
- 2026-03-14 (RUN_ID=20260314T070048Z):
  - `server-modernized/src/main/java/open/dolphin/rest/masterupdate/MasterUpdateService.java` の外部 HTTP 取得を `BodyHandlers.ofByteArray()` から `BodyHandlers.ofInputStream()` に変更し、一時ファイルへ stream 保存しながら SHA-256 とサイズを計算する構成へ変更した
  - artifact 保存は temp file を final artifact path へ移動する方式へ寄せ、record count 推定も `Path` ベースで zip/text を読み直すように整理した
  - `server-modernized/src/test/java/open/dolphin/rest/masterupdate/MasterUpdateServiceTest.java` を追加し、stream 保存時の hash/size 計算と zip entry 件数推定を確認した
- 次:
  - P7-01

---

## P7. 患者同期 upsert の一括化

### [x] P7-01 既存患者の先読みをバッチ化する
- 対象:
  - `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncService.java`
  - `PatientServiceBean`
  - 関連 repository
- 作業:
  - 100 件単位取得後に 1 件ずつ存在確認している経路を見直す
  - バッチ単位で既存患者を先にまとめて引く
- 完了条件:
  - 1 人ずつ `getPatientById` する構造が主経路から外れる
- 2026-03-14 (RUN_ID=20260314T070048Z):
  - `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncService.java` で、ORCA patient batch 応答ごとに patientId を集約し、`PatientServiceBean.getPatientList(facilityId, ids)` で既存患者を先読みした map を `upsertPatient(...)` へ渡す構成へ変更した
  - 通常経路の update/create 判定は先読み map を主軸にし、`getPatientById(...)` は add race 発生時の再確認 fallback に限定した
  - `server-modernized/src/test/java/open/dolphin/orca/sync/OrcaPatientSyncServiceTest.java` に、既存患者を含む import で batch lookup が 1 回、point lookup が 0 回のまま update/create を完了できることを追加した
- 次:
  - P7-02

### [x] P7-02 `facility_id + patient_id` 基準の一括 upsert に寄せる
- 対象:
  - 患者同期 service / repository / DB
- 作業:
  - 業務キーを確認する
  - 一括更新またはまとめ処理へ寄せる
  - flush の粒度を見直す
- 完了条件:
  - 患者同期の DB 往復が件数比例で増えにくくなっている
- blocker:
  - 業務キー確定に不足情報がある
- 2026-03-14 (RUN_ID=20260314T080100Z):
  - `persistence/src/main/java/open/dolphin/infomodel/PatientModel.java` と `tools/flyway/sql/V0300__baseline_fresh_schema.sql` の `(facilityId, patientId)` 一意制約を根拠に、同期業務キーを `facility_id + patient_id` へ固定した
  - `server-modernized/src/main/java/open/dolphin/session/PatientServiceBean.java` に、`INSERT ... ON CONFLICT (facilityid, patientid) DO UPDATE` を使う `upsertPatientsForSync(...)` を追加し、患者単位の `add/update/flush` を chunk 単位の native upsert へ集約した
  - upsert 後の `d_karte` 補完も `ensureKarteForPatients(...)` で一括確認する構成へ寄せ、PVT 通知更新は対象患者群を 1 回の走査で反映する形に整理した
  - `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncService.java` は detail 正規化後に `PatientServiceBean.upsertPatientsForSync(...)` を 1 回呼ぶ構成へ変更し、同期主経路から `getPatientById/addPatient/update` の患者単位呼び出しを外した
  - `server-modernized/src/test/java/open/dolphin/orca/sync/OrcaPatientSyncServiceTest.java` と `server-modernized/src/test/java/open/dolphin/session/PatientServiceBeanSyncPatientUpsertTest.java` を追加・更新し、bulk upsert 1 回委譲と `d_karte` の不足分のみ補完することを確認した
- 次:
  - P8-01

---

## P8. 検索系の重いクエリ整理

### [x] P8-01 ORCA マスタ検索の条件式を整理する
- 対象:
  - `server-modernized/src/main/java/open/orca/rest/OrcaMasterDao.java`
  - `server-modernized/src/main/java/open/orca/rest/EtensuDao.java`
  - 関連 resource
- 作業:
  - `%keyword%` と `UPPER(CAST(... AS VARCHAR)) LIKE` の多用箇所を確認する
  - 前方一致寄り、正規化列寄り、用途別 API 分離のうち、今回の安全範囲で改善できるものを実装する
- 完了条件:
  - 主要検索経路で最も重い条件式が少なくとも一段軽くなっている
- 2026-03-14 (RUN_ID=20260314T090102Z):
  - `server-modernized/src/main/java/open/orca/rest/MasterSearchKeywordSupport.java` を追加し、`OrcaMasterDao` / `EtensuDao` の keyword 条件生成を共通化した
  - `keyword` が数値コードまたは ORCA コードらしい入力の場合は、`%keyword%` の全列部分一致ではなく code 列の前方一致へ寄せ、`name` / `kana` 列の `UPPER(CAST(...)) LIKE` を外すよう変更した
  - 明示的な `method=partial|prefix` を受けた薬剤検索は既存挙動を維持しつつ、未指定時の重い code 検索だけを軽くした
  - `server-modernized/src/test/java/open/orca/rest/MasterSearchKeywordSupportTest.java` を追加し、code prefix 最適化と既存の partial/prefix 条件維持を固定した
- 次:
  - P8-02

### [x] P8-02 total count を必要画面だけに絞る
- 対象:
  - ORCA master 検索周辺
- 作業:
  - 毎回 `count(*)` を取っている箇所を整理する
  - 画面上本当に必要なケースだけ count を残す
- 完了条件:
  - 不要な count クエリが減っている
- 2026-03-14 (RUN_ID=20260314T100106Z):
  - `web-client/src/features/charts/orderMasterSearchApi.ts` の `totalCount?: number` とページ継続ロジックを再確認し、ORCA master 検索では `totalCount` 未返却時でも `pageItemCount === size` を基準に追加取得できること、表示件数も最終的に `items.length` へ収束することを確認した
  - `server-modernized/src/main/java/open/orca/rest/OrcaMasterResource.java` に `includeTotalCount=true|1|yes` の明示要求を追加し、既定では `totalCount` を返さず、必要時だけ exact count を返す API 契約へ整理した
  - `server-modernized/src/main/java/open/orca/rest/OrcaMasterDao.java` と `server-modernized/src/main/java/open/orca/rest/EtensuDao.java` で、generic-class / drug / comment / bodypart / etensu の `count(*)` を明示要求時だけ実行するよう変更した
  - `server-modernized/src/test/java/open/orca/rest/OrcaMasterResourceTest.java` を更新し、既定では `totalCount` と `X-Orca-Total-Count` が省略され、明示要求時のみ返ることを確認した
  - 矛盾メモ: 進捗正本の未完了先頭は本タスク `P8-02` だった一方、参考 WBS (`server_modernization_wbs_detailed.md`) の先頭未完了は `P10-07` のままで、未完了先頭タスクの位置が一致していない。今回の進捗判定は正本どおり revised workplan を優先した
- 次:
  - P8-03

### [x] P8-03 患者検索 API を用途別に分ける
- 対象:
  - `PatientServiceBean`
  - 関連 resource / test
- 作業:
  - 名前、かな、数字検索の段階的分岐を整理する
  - 用途別の単純な問い合わせへ寄せる
- 完了条件:
  - 1 リクエストで何段も条件を切り替える構造が一部でも解消している
- 2026-03-14 (RUN_ID=20260314T110104Z):
  - `server-modernized/src/main/java/open/dolphin/session/PatientServiceBean.java` に `PatientSearchType` と `searchPatients(...)` を追加し、`name` / `kana` / `patientId` / `telephone` / `zipCode` を用途別の単純 prefix query へ分離した
  - `getPatientsByName` / `getPatientsByKana` / `getPatientsByDigit` から、後方一致・appMemo・電話・郵便番号への段階フォールバックを外し、`/orca/patients/local-search` の既定用途である `氏名 / カナ / ID` に寄せた
  - `server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientLocalSearchResource.java` は payload の `searchType` または keyword から検索用途を解決して `PatientServiceBean.searchPatients(...)` へ委譲する構成へ変更し、audit details にも `searchType` を残すようにした
  - `server-modernized/src/test/java/open/dolphin/session/PatientServiceBeanPurposeSearchTest.java` を追加し、用途別検索が単一 query 系統で完結し、digit 検索が電話・郵便番号へ cascade しないことを確認した
  - `server-modernized/src/test/java/open/dolphin/orca/rest/OrcaPatientLocalSearchResourceTest.java` を更新し、keyword 由来の検索用途解決と明示 `searchType` 指定を固定した
- 次:
  - P9-01

---

## P9. 通知基盤と共有メモリの整理

### [x] P9-01 旧 AsyncContext 通知経路を凍結し、SSE 優先を明文化する
- 対象:
  - `ChartEventServiceBean`
  - `ServletContextHolder`
  - SSE 関連クラス
- 作業:
  - 二重通知基盤のうち、今後の主経路を SSE に寄せる方針をコードと文書で明示する
  - 新規利用を増やさないよう整理する
- 完了条件:
  - 通知基盤の優先経路が曖昧でない
- 2026-03-14 (RUN_ID=20260314T110104Z):
  - `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java` の `notifyEvent()` を、先に `ChartEventStreamPublisher.broadcast(...)` を呼ぶ構成へ整理し、legacy `AsyncContext` 配信は `dispatchLegacyAsyncContexts(...)` helper に隔離した
  - `server-modernized/src/main/java/open/dolphin/mbean/ServletContextHolder.java` の `AsyncContext` accessor に deprecated comment を付け、new realtime 実装は SSE を使う方針をコード上で明示した
  - `server-modernized/src/test/java/open/dolphin/session/ChartEventServiceBeanNotifyEventTest.java` を追加し、legacy subscriber がいない場合でも SSE broadcast が主経路として実行されること、legacy subscriber がいる場合は SSE の後に fallback dispatch されることを確認した
  - `docs/modernization/p9-01-sse-priority-notification-path.md` を追加し、SSE 主経路化と legacy long-poll 据え置き範囲を文書化した
- 次:
  - P9-02

### [x] P9-02 facility ごとの context 保持と cleanup を整理する
- 対象:
  - `ReceptionRealtimeSseSupport`
  - `ChartEventSseSupport`
  - `ServletContextHolder`
- 作業:
  - facility context の保持構造を見直す
  - 未使用 context の cleanup 条件を入れる
  - strong reference な gauge 登録を見直す
- 完了条件:
  - 施設コンテキストが増え続ける前提が緩和されている
- 2026-03-15 (RUN_ID=20260314T110104Z):
  - `server-modernized/src/main/java/open/dolphin/rest/ChartEventSseSupport.java` を、DB 履歴を replay 正本として扱う構成へ整理し、`broadcast()` は購読中 client がいない facility の context を新規作成しないよう変更した
  - `ChartEvent` の facility context は client 0 件時に破棄し、in-memory history も同時に消すよう変更した。再接続時の replay は `Last-Event-ID` を使って DB から取得する
  - `chartEvent.history.retained` gauge は `FacilityContext` 強参照をやめ、facility 単位の値 holder へ切り替えたうえで、context cleanup 時に meter remove する構成へ変更した
  - `server-modernized/src/main/java/open/dolphin/rest/ReceptionRealtimeSseSupport.java` は、購読中 client がいる間だけ facility context と in-memory history を保持し、client 0 件時に即 cleanup する構成へ変更した
  - `ReceptionRealtime` は cleanup 後の再接続で `reception.replay-gap` を返して一覧再取得へ倒し、`publishReceptionUpdate()` では購読中 client がいない facility の context を新規作成しない契約へ整理した
  - `server-modernized/src/test/java/open/dolphin/rest/ChartEventSseSupportTest.java` と `server-modernized/src/test/java/open/dolphin/rest/ReceptionRealtimeSseSupportTest.java` を更新し、zero-client cleanup 後の DB replay / replay-gap / context・gauge 非残留を固定した
  - `docs/server-modernization/reception-realtime-sync-20260219.md` に、ReceptionRealtime の cleanup / replay 契約を追記した
- 次:
  - P9-03

### [x] P9-03 書き込みの多いリスト構造を見直す
- 対象:
  - `CopyOnWriteArrayList` を使っている PVT / realtime 周辺
- 作業:
  - 読み取り中心か書き込み多めかを確認する
  - 書き込みの多い箇所は別構造へ寄せる
- 完了条件:
  - 書き込み頻度に不向きな共有構造が主要経路から減る
- 2026-03-15 (RUN_ID=20260315T000000Z):
  - `server-modernized/src/main/java/open/dolphin/mbean/ServletContextHolder.java` の facility 別 `pvtList` を `CopyOnWriteArrayList` から `Collections.synchronizedList(new ArrayList<>())` 管理へ変更し、読取は snapshot、構造変更は `addPvt` / `replaceOrAddPvt` / `removePvtById` / `clearPvtList` に集約した
  - `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java` と `server-modernized/src/main/java/open/dolphin/session/PVTServiceBean.java` を新しい helper に追従させ、PVT 追加・merge・削除・日次更新のホットパスから `CopyOnWriteArrayList` 前提を外した
  - `server-modernized/src/test/java/open/dolphin/mbean/ServletContextHolderTest.java` を追加し、snapshot 返却で外部構造変更を遮断できることと、replace/add/remove helper が内部リストへ反映されることを固定した
  - 参考資料側との矛盾として、`server_modernization_wbs_detailed.md` と `docs/server-modernization/README.md` の `P9-03` は依然「認証方式のセッション統一」を指しており、revised workplan の `P9-03`（共有リスト構造見直し）と番号対応が一致していないことを確認した
- 次:
  - P10-01

---

## P10. 巨大クラスの責務分割

### [x] P10-01 `PVTServiceBean.addPvt()` を補助メソッドへ分割する
- 対象:
  - `PVTServiceBean`
- 作業:
  - 232 行級の `addPvt()` を責務単位で分割する
  - 振る舞いは変えず、可読性とテストしやすさを上げる
- 完了条件:
  - `addPvt()` の責務が少なくなっている
- 2026-03-15 (RUN_ID=20260314T230036Z):
  - `server-modernized/src/main/java/open/dolphin/session/PVTServiceBean.java` の `addPvt()` を、入力正規化、患者 upsert、来院登録分岐、予定カルテ更新、当日受付 persist/merge の helper 群へ分割し、P4 で入れた idempotent 化と通知契約を維持したまま可読性を上げた
  - `server-modernized/src/test/java/open/dolphin/session/PVTServiceBeanAddPvtTest.java` に、予定カルテ既存受付を更新する経路の確認を追加し、当日受付用の既存テストと合わせて分割後の主経路を固定した
  - `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=PVTServiceBeanAddPvtTest,PVTServiceBeanClinicalTest test` を実行し、7 tests PASS を確認した
  - 矛盾メモ: 参考 WBS (`server_modernization_wbs_detailed.md`) の `P10-01`〜`P10-03` は「移行と本番切替」を指しており、revised workplan の `P10-01`〜`P10-03`（巨大クラスの責務分割）と番号帯が一致しない。今回の進捗判定は正本どおり revised workplan を優先した
- 次:
  - P10-02

### [x] P10-02 `RestOrcaTransport` の設定解決と送信責務を分ける
- 対象:
  - `RestOrcaTransport`
- 作業:
  - 設定解決、client 管理、送信呼び出しを分ける
- 完了条件:
  - P2 系で入れた改善が読みやすい構造に整理されている
- 2026-03-15 (RUN_ID=20260315T000038Z):
  - `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportRegistry.java` を追加し、facility 単位の設定解決、fingerprint による `HttpClient` 再利用判定、TLS 資材付き transport 構築を `RestOrcaTransport` から分離した
  - `server-modernized/src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java` は、facility/trace 解決と ORCA 送信 orchestration に責務を絞り、設定 reload・current settings・raw client 参照を registry 経由へ整理した
  - `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=RestOrcaTransportTest,KarteServiceBeanGetDocumentsBulkFetchTest,KarteResourceDocinfoAllPagingTest test` を実行し、9 tests PASS を確認した
- 次:
  - P10-03

### [x] P10-03 `KarteServiceBean` の一覧組み立て責務を分割する
- 対象:
  - `KarteServiceBean`
- 作業:
  - `/docinfo/all` に関係する一覧組み立て部分を抽出する
  - 重い一覧と詳細取得の境界を明確にする
- 完了条件:
  - 一覧 API 改修の保守性が上がっている
- 2026-03-15 (RUN_ID=20260315T000038Z):
  - `server-modernized/src/main/java/open/dolphin/session/KarteServiceBean.java` の `/docinfo/all` 経路を、ページ要求正規化、カルテ取得、文書 ID ページ取得、revision-light 読込の helper へ分割し、一覧組み立て責務と詳細取得責務の境界を明示した
  - 一覧経路の binary 非同梱契約は `loadRevisionLightDocumentPage(...)` に集約し、`loadDocuments(...)` の load mode 切替と分離した
  - `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=RestOrcaTransportTest,KarteServiceBeanGetDocumentsBulkFetchTest,KarteResourceDocinfoAllPagingTest test` を実行し、9 tests PASS を確認した
- 次:
  - P11-01

---

## P11. 古い構造の切り落とし準備

### [x] P11-01 旧設定読み込み経路の棚卸しを行う
- 対象:
  - `custom.properties`
  - JBoss/WildFly 固有パス依存
  - ローカルファイル状態保存
- 作業:
  - 旧設定経路を列挙する
  - 今後の切り落とし候補と据え置き候補を分ける
- 完了条件:
  - 次段の基盤刷新に向けた一覧がある
- 2026-03-15 (RUN_ID=20260315T000038Z):
  - `docs/modernization/p11-01-legacy-config-inventory.md` を追加し、`custom.properties` の直読/間接依存、`jboss.home.dir` / WildFly 固有パス依存、ローカルファイル state をファイル単位で棚卸しした
  - `ORCAConnection` / `OrcaResource` / `ChartEventServiceBean` / `SmsGatewayConfig` の legacy properties 読込、`FileLicenseRepository` / `PushEventDeduplicator` のローカル state、`RuntimeConfigurationSupport` / `AttachmentStorageConfigLoader` / `VelocityHelper` の WildFly パス依存を切り落とし候補と据え置き候補に分類した
  - `docs/server-modernization/README.md` に inventory 文書への導線を追加した
- 次:
  - P11-02

### [x] P11-02 ファイル依存設定の優先順位を整理する
- 対象:
  - ORCA 設定
  - attachment storage 設定
  - license / runtime state
- 作業:
  - DB、環境変数、設定ファイルの優先順位を確認する
  - 不要なフォールバックを減らすための前提整理を行う
- 完了条件:
  - 設定系刷新の次アクションが明確である
- 2026-03-15 (RUN_ID=20260315T000038Z):
  - `docs/modernization/p11-02-config-priority-matrix.md` を追加し、ORCA は `DB正本 -> env/system bootstrap -> legacy fallback撤去`、attachment は `env/secret -> config dir 配下 YAML -> fallback撤去`、license/runtime state は `DB正本 -> env/bootstrap -> file state撤去` の優先順位案を整理した
  - 現行コードの優先順位根拠として `OrcaConnectionConfigStore` / `RestOrcaTransport` / `OrcaTransportSettings` / `AttachmentStorageConfigLoader` / `FileLicenseRepository` / `PushEventDeduplicator` を参照し、次段の切り落とし候補を固定した
  - 本タスクは文書整理のみのため、コード変更向けの追加テストは実施していない
- 次:
  - P12-01

---

## P12. 配布物と運用上の無駄の整理

### [x] P12-01 リポジトリ運用対象からビルド成果物を外す
- 対象:
  - `target/`
  - zip 展開ゴミ
  - `__MACOSX`
  - ignore 設定
- 作業:
  - ソース配布物と生成物を分離する
  - ignore と文書を整える
- 完了条件:
  - レビューや CI に不要な成果物が混ざらない
- 2026-03-15 (RUN_ID=20260315T010035Z):
  - ルート `.gitignore` の Maven 生成物除外を `**/target/` に統一し、`common` / `server-modernized` に限らず追加モジュール (`domain` / `api-contract` など) の build 出力も個別追記なしで除外されるよう整理した
  - zip 展開ゴミ向けに `**/__MACOSX/` と AppleDouble (`**/._*`) を ignore へ追加し、誤って展開物がレビュー差分へ混ざらないようにした
  - `docs/server-modernization/README.md` に、生成物は Git 管理対象外とし、受領 zip 実体・surefire report・一時ログの扱いを明文化した
  - 参考メモ: 追跡済みの `server/server/target/classpath.txt` は legacy `server/` 配下であり、今回の automation 対象外かつ `server/` 変更禁止ルールのため未変更とした
- 次:
  - P12-02

### [x] P12-02 modernization 用ドキュメントの次段計画を更新する
- 対象:
  - 本文書
  - 必要なら WBS 参考資料
- 作業:
  - ここまでの実装結果を踏まえ、次段の大きい刷新テーマを整理する
- 完了条件:
  - automation の次期テーマが明確になっている
- 2026-03-15 (RUN_ID=20260315T010035Z):
  - `docs/modernization/p12-02-next-modernization-themes.md` を追加し、`P9-03`〜`P12-01` の実施結果を踏まえた次段テーマを「設定正本の一本化」「ファイル state / WildFly 固定パス fallback の縮退」「文書と運用番号の整流化」の 3 本に整理した
  - 人間レビューが先に判断すべき事項として、`custom.properties` 撤去の扱い、attachment 設定の正本、license / push dedupe state の移管先、legacy `server/` 配下の追跡済み生成物整理を明記した
  - `docs/server-modernization/README.md` に次段テーマ整理文書への導線を追加した
- 次:
  - 人間レビュー待ち

---

## 実行結果テンプレート
各 automation 実行の最後に、最低限以下を本文書または実行結果へ残すこと。

- 実行日
- 着手タスク ID
- 完了 / 未完 / blocker
- 主な変更ファイル
- 実施テスト
- 次回先頭タスク ID
- 補足メモ
