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

### [ ] P4-01 initializePvtList の問い合わせ構造を棚卸しする
- 対象:
  - `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java`
  - `server-modernized/src/main/java/open/dolphin/session/PVTServiceBean.java`
  - 関連 repository / DAO
- 作業:
  - 当日一覧初期化時に患者ごと追加参照している箇所を洗い出す
  - join 可能箇所、一括取得可能箇所、Java 側集計箇所を分ける
- 完了条件:
  - 次タスクで減らす対象問い合わせが明確である
- 次:
  - P4-02

### [ ] P4-02 initializePvtList を join または一括取得寄りにする
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
- 次:
  - P4-03

### [ ] P4-03 addPvt の重複確認と登録を idempotent に寄せる
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
- 次:
  - P4-04

### [ ] P4-04 addPvt 周辺の安全確認テストを追加する
- 対象:
  - PVT 周辺テスト
- 作業:
  - 正常追加
  - 重複追加
  - 業務キー重複時の扱い
- 完了条件:
  - 受付追加ホットパスの最低限の安全網がある
- 次:
  - P5-01

---

## P5. 全件返却 API のページング前提化

### [ ] P5-01 `/docinfo/all` の契約を棚卸しし、ページング案を文書化する
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
- 次:
  - P5-02

### [ ] P5-02 `/docinfo/all` をページング前提に変更する
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
- 次:
  - P5-03

### [ ] P5-03 全患者取得 API をページング前提へ変更する
- 対象:
  - `PatientServiceBean`
  - 関連 resource / test
- 作業:
  - ページングなし全取得経路を見直す
  - 画面用途ごとに必要件数を制限する
- 完了条件:
  - 無制限全件返却 API が主要経路から外れている
- 次:
  - P6-01

---

## P6. byte 配列偏重の削減

### [ ] P6-01 AttachmentStorageManager のホット経路を stream ベースへ寄せる
- 対象:
  - `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`
- 作業:
  - 読み込み、書き込みのうち hot path を特定する
  - `byte[]` 全載せを減らせる経路から stream 化する
  - 既存メソッド契約を壊さずに内部実装を改善する
- 完了条件:
  - ホット経路の主要メソッドで `byte[]` 全載せが避けられている
- 次:
  - P6-02

### [ ] P6-02 患者画像レスポンスを stream 寄りに整理する
- 対象:
  - `server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java`
  - 画像関連 service
- 作業:
  - 丸ごと `byte[]` 化して返す経路を見直す
  - 可能ならストリームまたは chunk 寄りに整理する
- 完了条件:
  - 画像返却の主要経路で不要な全載せが減っている
- 次:
  - P6-03

### [ ] P6-03 外部マスタ取得のバイナリ処理を stream ベースへ寄せる
- 対象:
  - `MasterUpdateService`
  - 関連 downloader / parser
- 作業:
  - 外部取得時のメモリ全載せ経路を確認し、stream で扱える範囲を整理する
- 完了条件:
  - 大きい外部データ取得時の一括メモリ保持が減っている
- 次:
  - P7-01

---

## P7. 患者同期 upsert の一括化

### [ ] P7-01 既存患者の先読みをバッチ化する
- 対象:
  - `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncService.java`
  - `PatientServiceBean`
  - 関連 repository
- 作業:
  - 100 件単位取得後に 1 件ずつ存在確認している経路を見直す
  - バッチ単位で既存患者を先にまとめて引く
- 完了条件:
  - 1 人ずつ `getPatientById` する構造が主経路から外れる
- 次:
  - P7-02

### [ ] P7-02 `facility_id + patient_id` 基準の一括 upsert に寄せる
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
- 次:
  - P8-01

---

## P8. 検索系の重いクエリ整理

### [ ] P8-01 ORCA マスタ検索の条件式を整理する
- 対象:
  - `server-modernized/src/main/java/open/orca/rest/OrcaMasterDao.java`
  - `server-modernized/src/main/java/open/orca/rest/EtensuDao.java`
  - 関連 resource
- 作業:
  - `%keyword%` と `UPPER(CAST(... AS VARCHAR)) LIKE` の多用箇所を確認する
  - 前方一致寄り、正規化列寄り、用途別 API 分離のうち、今回の安全範囲で改善できるものを実装する
- 完了条件:
  - 主要検索経路で最も重い条件式が少なくとも一段軽くなっている
- 次:
  - P8-02

### [ ] P8-02 total count を必要画面だけに絞る
- 対象:
  - ORCA master 検索周辺
- 作業:
  - 毎回 `count(*)` を取っている箇所を整理する
  - 画面上本当に必要なケースだけ count を残す
- 完了条件:
  - 不要な count クエリが減っている
- 次:
  - P8-03

### [ ] P8-03 患者検索 API を用途別に分ける
- 対象:
  - `PatientServiceBean`
  - 関連 resource / test
- 作業:
  - 名前、かな、数字検索の段階的分岐を整理する
  - 用途別の単純な問い合わせへ寄せる
- 完了条件:
  - 1 リクエストで何段も条件を切り替える構造が一部でも解消している
- 次:
  - P9-01

---

## P9. 通知基盤と共有メモリの整理

### [ ] P9-01 旧 AsyncContext 通知経路を凍結し、SSE 優先を明文化する
- 対象:
  - `ChartEventServiceBean`
  - `ServletContextHolder`
  - SSE 関連クラス
- 作業:
  - 二重通知基盤のうち、今後の主経路を SSE に寄せる方針をコードと文書で明示する
  - 新規利用を増やさないよう整理する
- 完了条件:
  - 通知基盤の優先経路が曖昧でない
- 次:
  - P9-02

### [ ] P9-02 facility ごとの context 保持と cleanup を整理する
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
- 次:
  - P9-03

### [ ] P9-03 書き込みの多いリスト構造を見直す
- 対象:
  - `CopyOnWriteArrayList` を使っている PVT / realtime 周辺
- 作業:
  - 読み取り中心か書き込み多めかを確認する
  - 書き込みの多い箇所は別構造へ寄せる
- 完了条件:
  - 書き込み頻度に不向きな共有構造が主要経路から減る
- 次:
  - P10-01

---

## P10. 巨大クラスの責務分割

### [ ] P10-01 `PVTServiceBean.addPvt()` を補助メソッドへ分割する
- 対象:
  - `PVTServiceBean`
- 作業:
  - 232 行級の `addPvt()` を責務単位で分割する
  - 振る舞いは変えず、可読性とテストしやすさを上げる
- 完了条件:
  - `addPvt()` の責務が少なくなっている
- 次:
  - P10-02

### [ ] P10-02 `RestOrcaTransport` の設定解決と送信責務を分ける
- 対象:
  - `RestOrcaTransport`
- 作業:
  - 設定解決、client 管理、送信呼び出しを分ける
- 完了条件:
  - P2 系で入れた改善が読みやすい構造に整理されている
- 次:
  - P10-03

### [ ] P10-03 `KarteServiceBean` の一覧組み立て責務を分割する
- 対象:
  - `KarteServiceBean`
- 作業:
  - `/docinfo/all` に関係する一覧組み立て部分を抽出する
  - 重い一覧と詳細取得の境界を明確にする
- 完了条件:
  - 一覧 API 改修の保守性が上がっている
- 次:
  - P11-01

---

## P11. 古い構造の切り落とし準備

### [ ] P11-01 旧設定読み込み経路の棚卸しを行う
- 対象:
  - `custom.properties`
  - JBoss/WildFly 固有パス依存
  - ローカルファイル状態保存
- 作業:
  - 旧設定経路を列挙する
  - 今後の切り落とし候補と据え置き候補を分ける
- 完了条件:
  - 次段の基盤刷新に向けた一覧がある
- 次:
  - P11-02

### [ ] P11-02 ファイル依存設定の優先順位を整理する
- 対象:
  - ORCA 設定
  - attachment storage 設定
  - license / runtime state
- 作業:
  - DB、環境変数、設定ファイルの優先順位を確認する
  - 不要なフォールバックを減らすための前提整理を行う
- 完了条件:
  - 設定系刷新の次アクションが明確である
- 次:
  - P12-01

---

## P12. 配布物と運用上の無駄の整理

### [ ] P12-01 リポジトリ運用対象からビルド成果物を外す
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
- 次:
  - P12-02

### [ ] P12-02 modernization 用ドキュメントの次段計画を更新する
- 対象:
  - 本文書
  - 必要なら WBS 参考資料
- 作業:
  - ここまでの実装結果を踏まえ、次段の大きい刷新テーマを整理する
- 完了条件:
  - automation の次期テーマが明確になっている
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
