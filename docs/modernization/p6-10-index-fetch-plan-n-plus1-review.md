# P6-10 index・fetch plan・N+1 見直し（RUN_ID: 20260311T210122Z）

## 目的
- 重い3経路（カルテ一覧、患者検索、ORCA 同期）で、既存実装のボトルネックを低コストで潰す。
- `P6-08` までで導入済みの schema に対して、追加 migration で index を補強する。

## 実装方針
- 大きなロジック変更は避け、次の3点を実施。
  - ORCA 同期が多用する `PatientServiceBean#getPatientById` を `LIKE` から厳密一致 `=` へ変更。
  - カルテ文書ヘッダ取得と画像一覧取得の並び順・絞り込みに合う複合 index を追加。
  - 患者検索（電話/携帯/郵便番号の前方一致、appMemo の部分一致）向け index を追加。

## 変更内容
### 1) ORCA 同期経路（患者ID解決）の見直し
- 対象: `server-modernized/src/main/java/open/dolphin/session/PatientServiceBean.java`
- 変更:
  - `QUERY_PATIENT_BY_FID_PID_PREFIX`（前方一致検索用）と `QUERY_PATIENT_BY_FID_PID_EXACT`（厳密一致）を分離。
  - `getPatientById` は厳密一致クエリへ切替。
- 期待効果:
  - ORCA 同期の upsert ループで繰り返し呼ばれる患者解決が、`d_patient(facilityid, patientid)` の unique index を素直に使える。

### 2) Flyway migration 追加（V0303）
- 追加:
  - `server-modernized/tools/flyway/sql/V0303__performance_index_tuning.sql`
  - runtime classpath へは build で生成コピー
- 追加 index:
  - `d_document_karte_status_started_id_idx` on `d_document(karte_id, status, started DESC, id DESC)`
  - `d_attachment_doc_linkrelation_status_id_idx` on `d_attachment(doc_id, linkrelation, status, id DESC)`
  - `d_patient_facility_telephone_prefix_idx` on `d_patient(facilityid, telephone text_pattern_ops)`
  - `d_patient_facility_mobilephone_prefix_idx` on `d_patient(facilityid, mobilephone text_pattern_ops)`
  - `d_patient_facility_zipcode_prefix_idx` on `d_patient(facilityid, zipcode text_pattern_ops)`
  - `d_patient_appmemo_trgm_idx` on `d_patient using gin(appmemo gin_trgm_ops)`

### 3) baseline検証の強化
- 対象: `server-modernized/src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`
- 変更:
  - 最新 migration 期待値を `0303` へ更新。
  - `pg_indexes` 確認ヘルパーを追加し、V0303 の index 生成を検証。

## N+1 / fetch plan 観点
- カルテ文書詳細取得（`getDocuments`）は既存の bulk fetch 4クエリ構成を維持（N+1 へ退行なし）。
- 今回は fetch 戦略の再分割ではなく、`order by` と絞り込み条件に合わせた index 補強を優先。

## 検証コマンドと結果
- `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -o -f pom.server-modernized.xml -pl server-modernized -am -DskipTests test-compile`
  - PASS
- `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -o -f pom.server-modernized.xml -pl server-modernized -am -DargLine=-javaagent:/Users/Hayato/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.12/byte-buddy-agent-1.14.12.jar -Dtest=PatientServiceBeanAddPatientTest,FlywayMigrationConsistencyTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - PASS
- `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -o -f pom.server-modernized.xml -pl server-modernized -am -Dtest=FreshSchemaBaselineTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - FAIL（sandbox 制約により embedded postgres のソケット bind が不可: `java.net.SocketException: Operation not permitted`）

## 補足（次段の観測項目）
- `P10-04` 負荷試験で、以下の実測を再確認する。
  - カルテ文書ヘッダ取得の `karte_id + status + started` 絞り込みの実行計画
  - 画像一覧（`linkrelation` 固定）の応答時間
  - ORCA 同期（同一施設・多数 patientId upsert）の患者解決 latency
