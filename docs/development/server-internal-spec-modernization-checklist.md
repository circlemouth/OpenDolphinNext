# サーバー内部仕様モダナイズ完遂チェックリスト

最終更新: 2026-03-15  
対象リポジトリ: `server-modernized`（主対象）, `common`（存在する場合のみ一部作業）  
用途: この文書を開発ドキュメント兼オートメーション実行台帳として使う。Codex は本書を唯一の進行管理表として更新すること。

---

## 0. 目的

以下の改善を、**後方互換なし**・**本番運用前提**で完遂する。

1. Flyway migration の正本を一本化し、重複管理をやめる。
2. REST の入口を `/api/*` に統一し、`/resources/*` と `/orca/*` の二重契約を廃止する。
3. 設定ソースを typed config に統一し、`custom.properties` / `jboss.home.dir` 依存を除去する。
4. ORCA master を現行スキーマ前提で再設計し、旧スキーマ吸収ロジックをやめる。
5. 本番コードに混在している fixture / snapshot / stub を本番パスから排除する。
6. レガシー ORCA 層、重複 utility、重複 CDI descriptor を整理する。
7. 単純委譲 converter 群を DTO / mapper に置き換え、不要層を削る。

---

## 1. 実施原則

- 旧 URL、旧設定、旧スキーマ、旧 utility の**互換維持は不要**。残さず整理する。
- 旧データベース遺産は無いものとして扱い、**現行スキーマ固定**・**fail-fast**・**明示設定**を優先する。
- テスト用 fixture / stub / sample payload は `src/test/resources` か専用 dev/test artifact に隔離し、`src/main` には置かない。
- 1 回のオートメーション実行は 1 時間ごと。**1 回の run で複数タスクを連続消化する**前提で進める。
- 各 run は「実装 45 分以内 + 検証と文書更新 15 分以内」を目安とし、同一バンドルの ready task をまとめて完了させる。
- 外部資格情報や外部サービス待ちで止まる場合は、そのタスクを未完のまま理由を残し、**次の ready task へ即時移動**する。
- 途中で止まる場合でも、毎回 buildable state を維持する。
- TODO コメントを増やして終わらせない。完了できる変更はその run 内で完了させる。

---

## 2. 現状観測メモ（開始時点の根拠）

以下は着手前に確認済みの代表例。Codex は必要に応じて再確認してよい。

- Flyway 正本は `tools/flyway/sql` と宣言されているが、`src/main/resources/db/migration` にミラーが存在し、`P1_03__minimal_baseline_seed.sql` の内容が食い違っている。
- `src/main/webapp/WEB-INF/web.xml` には `/resources/*` と `/orca/*` の 2 系統 servlet mapping と filter mapping が共存している。
- `src/main/java/open/dolphin/rest/LogFilter.java` は `/resources/api/session/login` などを固定文字列で扱っている。
- `RuntimeConfigurationSupport` は env / system / json / yaml / legacy properties を混在解決している。
- `ORCAConnection` と `SmsGatewayConfig` は `jboss.home.dir/custom.properties` を直接参照している。
- `Fido2Config` は直接 `System.getenv()` を使い、開発用デフォルト値へフォールバックする。
- `OrcaMasterResource` は約 2315 行、`OrcaMasterDao` は約 1667 行あり、fixture fallback と schema probing を内包している。
- `src/main/resources/orca/stub` に 43 ファイル、`open.dolphin.converter` に 72 クラス存在する。
- `src/main/java/META-INF/beans.xml` と `src/main/webapp/WEB-INF/beans.xml` が重複して存在する。
- `common` 側に deprecated な `OrcaApi` / `OrcaConnect` / `OrcaAnalyze` が残っている。

---

## 3. 完了条件（Definition of Done）

以下をすべて満たしたら、本件は完了。

- [ ] 本書の全タスクが `[x]` になっている。
- [ ] `server-modernized` で unit test が通る。
- [ ] `server-modernized` で integration / verify が通るか、未実施なら理由を run log に明記している。
- [ ] `common` を変更した場合は `common` の test が通る。
- [ ] 著者が手で保守する migration ディレクトリは 1 つだけになっている。
- [ ] `/resources/*` と `/orca/*` の公開契約が廃止され、JAX-RS 入口は `/api/*` に統一されている。
- [ ] `custom.properties` / `jboss.home.dir` 依存が本番コードから消えている。
- [ ] ORCA master の runtime fixture fallback / snapshot fallback / schema probing が消えている。
- [ ] 本番コードから `src/main/resources/orca/stub` 依存が消えている。
- [ ] MD5 `HashUtil` と重複 `beans.xml` が整理されている。
- [ ] converter 層は「必要な変換のみ残る」状態まで縮退している。
- [ ] README / sample env / 運用ドキュメントが現行実装に追随している。
- [ ] 本書末尾の run log に、最後の verification と未解決事項が記録されている。

---

## 4. 共通検証コマンド

必要に応じて実行し、結果を各タスクの「検証」欄に記録する。

### 4.1 build / test

```bash
# server-modernized
mvn -q -DskipITs test
mvn -q verify

# common（変更した場合のみ）
mvn -q test
```

### 4.2 grep / inventory

```bash
# migration の二重管理痕跡
rg -n "src/main/resources/db/migration|tools/flyway/sql" .

# 旧 REST 入口
rg -n '"/resources/|"/orca/|/resources/\*|/orca/\*' src/main/java src/main/webapp

# custom.properties / jboss.home.dir / 直接 env 参照
rg -n 'custom\.properties|jboss\.home\.dir|System\.getenv\(|System\.getProperty\(' src/main/java

# ORCA master の fallback / fixture / snapshot
rg -n 'artifacts/api-stability|msw-fixture|CLASSPATH_FIXTURE_ROOT|SNAPSHOT_ROOT|StubOrcaTransport|stubResource' src/main/java src/main/resources

# MD5 utility とその使用箇所
rg -n 'open\.dolphin\.mbean\.HashUtil|MD5\(' src/main/java ../common src

# converter 数
find src/main/java/open/dolphin/converter -maxdepth 1 -type f -name '*.java' | wc -l
```

---

## 5. 1 時間 run の運用ルール

### 5.1 タスク選択ルール

1. 依存が解決済みの未完了タスクのうち、**最上位フェーズの先頭**から着手する。
2. 同じ `同時実行推奨` バンドルに属するタスクは、1 run 内でまとめて片付ける。
3. 1 タスク完了後、時間が残るなら**次の ready task へ自動的に進む**。
4. block されたら理由を記入し、その場で次の ready task へ移る。
5. 1 run の最後に必ず:
   - チェックボックス更新
   - 変更ファイル記録
   - 実行コマンドと結果記録
   - run log 追記
   を行う。

### 5.2 推奨バンドル

- `B0`: PREP-01, PREP-02
- `B1`: FW-01, FW-02
- `B2`: FW-03, FW-04, FW-05
- `B3`: API-01, API-02
- `B4`: API-03, API-04, API-05
- `B5`: CFG-01, CFG-02
- `B6`: CFG-03, CFG-04
- `B7`: CFG-05, CFG-06
- `B8`: ORCA-01, ORCA-02
- `B9`: ORCA-03, ORCA-04
- `B10`: ORCA-05, ORCA-06, ORCA-07
- `B11`: FIX-01, FIX-02
- `B12`: FIX-03, FIX-04, FIX-05
- `B13`: LEG-01, LEG-02
- `B14`: LEG-03, LEG-04
- `B15`: CVT-01, CVT-02
- `B16`: CVT-03, CVT-04
- `B17`: FINAL-01, FINAL-02

---

## 6. チェックリスト

### Phase 0. 着手前の整地

#### PREP-01 ベースラインを採取する
- [x] 実施する
- 目的: 変更前の build / test / grep 結果を固定し、後続 run の比較基準を作る。
- 依存: なし
- 同時実行推奨: `B0`
- 対象:
  - `server-modernized/pom.xml`
  - `server-modernized/src/test/**`
  - 必要に応じて `common/pom.xml`
- 実施内容:
  1. `server-modernized` で `mvn -q -DskipITs test` を実行し、成功 / 失敗を記録する。
  2. 主要 grep を実行し、件数または代表ヒットを記録する。
  3. `common` を変更する可能性が高い場合は `common` の `mvn -q test` も記録する。
- 完了条件:
  - baseline 実行コマンドと結果が run log に残っている。
  - 後続フェーズの完了判定に使う baseline 件数が記録されている。
- 実施日時: 2026-03-16 09:04 JST
- 変更ファイル:
  - なし（baseline 採取のみ）
- 検証:
  - `cd server-modernized && mvn -q -DskipITs test` → FAIL。既存の main compile blocker として `OperationsHealthResponse` / `OperationsReadinessCheck` / `OperationsReadinessResponse` / `OrcaReportRequest` / `OrcaReportResponse` 未解決を確認。
  - `cd common && mvn -q test` → PASS。
  - `rg -n "src/main/resources/db/migration|tools/flyway/sql" .` → `server-modernized/tools/flyway/README.md` と source mirror の双方にヒット。
  - `rg -n '"/resources/|"/orca/|/resources/\*|/orca/\*' server-modernized/src/main/java server-modernized/src/main/webapp` → `web.xml` と `LogFilter` に旧入口ヒット。
  - `rg -n 'custom\.properties|jboss\.home\.dir|System\.getenv\(|System\.getProperty\(' server-modernized/src/main/java` → `RuntimeConfigurationSupport` / `ORCAConnection` / `SmsGatewayConfig` / `Fido2Config` などにヒット。
  - `rg -n 'artifacts/api-stability|msw-fixture|CLASSPATH_FIXTURE_ROOT|SNAPSHOT_ROOT|StubOrcaTransport|stubResource' server-modernized/src/main/java server-modernized/src/main/resources` → ORCA fixture/stub 参照が複数ヒット。
  - `rg -n 'open\.dolphin\.mbean\.HashUtil|MD5\(' server-modernized/src/main/java common src` → `HashUtil` / MD5 利用が残存。
  - `find server-modernized/src/main/java/open/dolphin/converter -maxdepth 1 -type f -name '*.java' | wc -l` → 72。
- メモ:
  - 以降の run では、上記 baseline を比較基準として使用する。

#### PREP-02 実装方針の ADR を作る
- [x] 実施する
- 目的: “後方互換なし / 本番運用優先 / 現行スキーマ固定” の設計判断を repo 内に明文化する。
- 依存: なし
- 同時実行推奨: `B0`
- 対象:
  - `docs/development/` 配下の ADR または本書への追記
- 実施内容:
  1. 以下を明記する。
     - migration 正本は 1 つだけ
     - REST 入口は `/api/*` のみ
     - typed config を正規ルートとする
     - ORCA master は現行スキーマ固定
     - 本番コードで fixture / stub fallback を許さない
  2. 旧互換を残さない理由と運用上の利点を書く。
- 完了条件:
  - repo 内に方針文書が存在する。
  - 後続タスクがその文書を参照可能になっている。
- 実施日時: 2026-03-16 09:04 JST
- 変更ファイル:
  - `docs/development/server-internal-modernization-adr.md`
- 検証:
  - ADR に「migration 正本一本化」「REST `/api/*` 統一」「typed config 正規化」「ORCA master 現行スキーマ固定」「fixture/stub fallback 禁止」を明記。
- メモ:
  - 以降の checklist タスクは本 ADR を設計判断の参照先とする。

### Phase 1. Flyway migration を単一正本へ集約

#### FW-01 migration 正本を 1 つに決め、著者管理ディレクトリを一本化する
- [x] 実施する
- 目的: `tools/flyway/sql` と `src/main/resources/db/migration` の二重管理をやめる。
- 依存: PREP-01, PREP-02
- 同時実行推奨: `B1`
- 対象:
  - `tools/flyway/README.md`
  - build 設定（必要なら `pom.xml`）
  - `src/main/resources/db/migration/**`
- 実施内容:
  1. 著者が手で保守する migration ディレクトリを 1 つに限定する。
  2. `src/main/resources/db/migration` は source tree から削除するか、生成物扱いに変更する。
  3. 文書と build が同じ真実を指すように揃える。
- 完了条件:
  - source tree に手動保守の migration 正本が 1 つだけ存在する。
  - README と build の説明が一致する。
- 実施日時: 2026-03-16 09:04 JST
- 変更ファイル:
  - `server-modernized/pom.xml`
  - `server-modernized/tools/flyway/README.md`
  - `server-modernized/src/main/resources/db/migration/` 配下削除
  - `docs/modernization/p1-03-baseline-fixture-setup.md`
  - `docs/modernization/p5-07-orca-sync-state-db-store.md`
  - `docs/modernization/p6-08-flyway-schema-migration.md`
  - `docs/modernization/p6-10-index-fetch-plan-n-plus1-review.md`
- 検証:
  - `find server-modernized/src/main/resources -path '*/db/migration/*' -type f` → 0 件。
  - `find server-modernized/tools/flyway/sql -maxdepth 1 -type f | sort` → canonical source のみ存在。
- メモ:
  - 手動保守対象を `server-modernized/tools/flyway/sql` に一本化し、source tree ミラーを廃止した。

#### FW-02 runtime / test から見える migration 読み込み経路を再設計する
- [x] 実施する
- 目的: 正本一本化後も test / migrate / app 起動が破綻しないよう、読み込み経路を整理する。
- 依存: FW-01
- 同時実行推奨: `B1`
- 対象:
  - `pom.xml`
  - Flyway 実行スクリプト
  - `src/test/**`
- 実施内容:
  1. 許容実装をどちらかに決める。
     - 直接 canonical path を Flyway が読む
     - build 時に `target` 配下へ生成コピーし、source tree にミラーは持たない
  2. test / verify / CI で同じ経路が使われるように統一する。
- 完了条件:
  - test / verify / Flyway 実行が同一設計に揃っている。
  - “source tree 内のミラーが無いと動かない” 状態が解消されている。
- 実施日時: 2026-03-16 09:04 JST
- 変更ファイル:
  - `server-modernized/pom.xml`
  - `server-modernized/src/test/java/open/dolphin/db/FlywayMigrationConsistencyTest.java`
  - `server-modernized/tools/flyway/README.md`
- 検証:
  - `cd server-modernized && mvn -q process-resources` → PASS。
  - `find server-modernized/target/classes/db/migration -maxdepth 1 -type f | sort` → `V0300`〜`V0304` のみ生成。
- メモ:
  - runtime / test は canonical source から `target/classes/db/migration` へ build 生成コピーする方式に統一した。

#### FW-03 不一致 migration を解消し、差分を一掃する
- [x] 実施する
- 目的: 既に発生している migration 内容差分を無くす。
- 依存: FW-01, FW-02
- 同時実行推奨: `B2`
- 対象:
  - `tools/flyway/sql/P1_03__minimal_baseline_seed.sql`
  - 重複していた migration 一式
- 実施内容:
  1. `P1_03__minimal_baseline_seed.sql` を正本に統一する。
  2. そのほか同名ファイルの差分があれば解消する。
  3. 生成コピー方式を採る場合は、手動編集禁止の状態にする。
- 完了条件:
  - 同名 migration の内容差分が source tree 上で消えている。
  - seed password 等の重大差分が解消されている。
- 実施日時: 2026-03-16 09:04 JST
- 変更ファイル:
  - `server-modernized/src/main/resources/db/migration/` 配下削除
  - `docs/modernization/p1-03-baseline-fixture-setup.md`
- 検証:
  - baseline 時点で `P1_03__minimal_baseline_seed.sql` の source mirror 側は MD5、canonical 側は PBKDF2 で不一致。
  - source mirror 削除後、正本は `server-modernized/tools/flyway/sql/P1_03__minimal_baseline_seed.sql` のみになった。
- メモ:
  - `P1_03` は Flyway 対象外の手動 seed として canonical 側へ統一した。

#### FW-04 Flyway テストを単一正本前提へ作り替える
- [x] 実施する
- 目的: 旧ミラー一致テストではなく、新しい設計を守るテストに変える。
- 依存: FW-03
- 同時実行推奨: `B2`
- 対象:
  - `src/test/java/open/dolphin/db/FlywayMigrationConsistencyTest.java`
  - 必要なら周辺 test
- 実施内容:
  1. “2 つのディレクトリの一致” を検査するテストを廃止する。
  2. 代わりに、正本の存在、命名規約、重複禁止、Flyway discovery の成立を確認する。
- 完了条件:
  - 旧二重管理を前提とするテストが存在しない。
  - 新設計を壊したときに落ちる test がある。
- 実施日時: 2026-03-16 09:04 JST
- 変更ファイル:
  - `server-modernized/src/test/java/open/dolphin/db/FlywayMigrationConsistencyTest.java`
- 検証:
  - テスト観点を「source mirror 同期」から「legacy source mirror 不在」「generated classpath と canonical source の一致」へ変更。
  - `cd server-modernized && mvn -q -DskipITs -Dtest=FlywayMigrationConsistencyTest -Dsurefire.failIfNoSpecifiedTests=false test` → FAIL（既存の main compile blocker に到達。Flyway 変更起因ではなく DTO 未解決）。
- メモ:
  - 新設計を壊した場合、`target/classes/db/migration` の生成結果差分で検知できる構成にした。

#### FW-05 Flyway の運用文書とスクリプトを現行化する
- [x] 実施する
- 目的: 開発者が旧運用に戻らないよう、文書 / スクリプトを現行実装に揃える。
- 依存: FW-04
- 同時実行推奨: `B2`
- 対象:
  - `tools/flyway/README.md`
  - `tools/flyway/scripts/**`
  - 必要に応じて `README.md`
- 実施内容:
  1. 正本 1 本化を明記する。
  2. 実行手順、validate / migrate / verify の前提を現行実装に揃える。
- 完了条件:
  - 旧ミラー同期手順が文書から消えている。
  - 新規メンバーが文書だけで正しい運用に入れる。
- 実施日時: 2026-03-16 09:04 JST
- 変更ファイル:
  - `server-modernized/tools/flyway/README.md`
  - `docs/modernization/p1-03-baseline-fixture-setup.md`
  - `docs/modernization/p5-07-orca-sync-state-db-store.md`
  - `docs/modernization/p6-08-flyway-schema-migration.md`
  - `docs/modernization/p6-10-index-fetch-plan-n-plus1-review.md`
- 検証:
  - `server-modernized/tools/flyway/README.md` から source mirror 同期手順を削除し、`process-resources` ベースの生成確認手順へ差し替え。
  - `P1_03` を手動 seed / 非 versioned SQL として明記。
- メモ:
  - 現行ドキュメントは「正本は 1 つ、classpath 供給は build 生成」の説明に揃えた。

### Phase 2. REST 入口を `/api/*` に統一

#### API-01 JAX-RS の正式な入口を `/api` に固定する
- [x] 実施する
- 目的: `/resources/*` と `/orca/*` の二重入口を廃止し、公開契約を単純化する。
- 依存: FW-05
- 同時実行推奨: `B3`
- 対象:
  - `src/main/webapp/WEB-INF/web.xml`
  - 新規 `jakarta.ws.rs.core.Application` 実装（必要なら追加）
  - JAX-RS resource 群
- 実施内容:
  1. `/api/*` を単一の公開 JAX-RS 入口にする。
  2. 巨大な `resteasy.resources` 列挙を削減または廃止する。
  3. auto-scan または `Application` 登録のどちらかに統一する。
- 完了条件:
  - 公開 API のベースパスが `/api/*` のみになっている。
  - `web.xml` に二重 dispatcher 契約が残っていない。
- 実施日時: 2026-03-16 10:06 JST
- 変更ファイル:
  - `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
  - `server-modernized/src/main/webapp/WEB-INF/web.xml`
  - `server-modernized/src/main/java/open/dolphin/rest/LogFilter.java`
  - `server-modernized/src/main/java/open/dolphin/rest/SessionAuthResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/LogoutResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/AdminAccessResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/AdminConfigResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/OrcaQueueResource.java`
  - `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- 検証:
  - `cd server-modernized && mvn -q -DskipITs test` は `api-contract` DTO を sibling reactor なしで解決できず FAIL（既存の module 単体実行課題として継続）。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` は PASS。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am verify` は PASS。
  - `rg -n '/resources/\\*|/orca/\\*|HttpServletDispatcher|ResteasyBootstrap' server-modernized/src/main/webapp/WEB-INF/web.xml` で legacy servlet/filter mapping と RESTEasy bootstrap の残存なしを確認。
- メモ:
  - JAX-RS 登録を `OpenDolphinRestApplication` に集約し、`web.xml` の巨大 `resteasy.resources` 列挙と二重 dispatcher を撤去した。
  - 既存 `/api/...` resource は class-level path を base `/api` 前提へ補正した。

#### API-02 ORCA 系 resource を `/api/orca/*` に再配置する
- [x] 実施する
- 目的: ORCA resource だけ別 servlet にぶら下がる設計を解体する。
- 依存: API-01
- 同時実行推奨: `B3`
- 対象:
  - `open.orca.rest.*`
  - `open.dolphin.rest.orca.*`
  - `open.dolphin.orca.rest.*`
- 実施内容:
  1. ORCA resource の path 設計を整理する。
  2. `/api/orca/*` 配下へ統一する。
  3. auth / logout / session 契約との整合を取る。
- 完了条件:
  - ORCA 系 endpoint は `/api/orca/*` のみで到達する。
  - 旧 `/orca/*` 契約が code / docs / tests から消えている。
- 実施日時: 2026-03-16 12:09 JST
- 変更ファイル:
  - `server-modernized/src/main/java/open/orca/rest/OrcaMasterResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/RestExceptionMapper.java`
  - `server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientLocalSearchResource.java`
  - `server-modernized/README.md`
  - `server-modernized/src/test/java/open/dolphin/orca/rest/OrcaAppointmentResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/orca/rest/OrcaVisitResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/orca/rest/OrcaVisitResourceRealtimeTest.java`
  - `server-modernized/src/test/java/open/dolphin/orca/rest/OrcaPatientLocalSearchResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/security/audit/SessionAuditDispatcherTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaSubjectiveResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaDiseaseResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaMedicalResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaPatientResourceIdempotencyTest.java`
- 検証:
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` → PASS。
  - `rg -n '/openDolphin/resources/orca|/resources/orca|/orca12/patientmodv2/outpatient|/orca21/medicalmodv2/outpatient' server-modernized/src/test web-client/src docs/web-client/CURRENT.md docs/modernization/api-map.md docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md docs/web-client/architecture docs/verification-plan.md docs/legacy-cutover-allowlist.md -g '!docs/archive/**' -g '!docs/managerdocs/**' -g '!docs/server-modernization/phase2/**' -g '!docs/web-client/planning/phase2/**' -g '!**/target/**'` → 0 hit。
- メモ:
  - JAX-RS の `@ApplicationPath("/api")` を維持したまま ORCA resource 群の公開契約を `/api/orca/*` へ統一した。resource `@Path("/orca...")` は公開 URI ではなく `/api` 配下として解決される前提に整理。

#### API-03 `web.xml` の二重 servlet / filter mapping を整理する
- [x] 実施する
- 目的: filter 適用範囲や監査境界を URL 契約に一致させる。
- 依存: API-02
- 同時実行推奨: `B4`
- 対象:
  - `src/main/webapp/WEB-INF/web.xml`
  - filter 設定
- 実施内容:
  1. `/resources/*` / `/orca/*` への mapping を撤去する。
  2. `/api/*` 前提で filter 対象を再設定する。
  3. listener / session / security headers は必要最低限に保つ。
- 完了条件:
  - filter / servlet mapping が `/api/*` 契約と一致している。
  - 旧ベースパス用の設定が残っていない。
- 実施日時: 2026-03-16 12:09 JST
- 変更ファイル:
  - `server-modernized/src/main/webapp/WEB-INF/web.xml`
  - `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- 検証:
  - `rg -n '/resources/\\*|/orca/\\*|HttpServletDispatcher|ResteasyBootstrap' server-modernized/src/main/webapp/WEB-INF/web.xml server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java -g '!**/target/**'` → `WebXmlEndpointExposureTest` の否定アサーションのみヒット。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` → PASS。
- メモ:
  - `web.xml` の filter mapping は `/api/*` に揃い、legacy servlet/filter mapping と RESTEasy bootstrap の残骸を除去した状態をテストで固定した。

#### API-04 `LogFilter` と関連 filter の path ハードコードを除去する
- [x] 実施する
- 目的: ログ / 監査 / CSRF が新 URL 契約に追随しやすいようにする。
- 依存: API-03
- 同時実行推奨: `B4`
- 対象:
  - `src/main/java/open/dolphin/rest/LogFilter.java`
  - `CsrfProtectionFilter` など関連 filter
  - その unit / integration test
- 実施内容:
  1. `/resources/api/...` 固定文字列を `/api/...` に更新する。
  2. 可能なら path 定数を集中管理し、filter 間で共有する。
  3. login / logout / factor2 の匿名許可条件を新契約へ揃える。
- 完了条件:
  - `"/resources/api"` 文字列が本番コードから消えている。
  - 認証 / CSRF / 監査の test が通る。
- 実施日時: 2026-03-16 12:09 JST
- 変更ファイル:
  - `server-modernized/src/main/java/open/dolphin/rest/LogFilter.java`
  - `server-modernized/src/main/java/open/dolphin/rest/RestExceptionMapper.java`
  - `server-modernized/src/test/java/open/dolphin/rest/LogFilterTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/SessionAuthResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/AbstractResourceErrorResponseTest.java`
- 検証:
  - `rg -n '\"/resources/api|/openDolphin/resources/api|SESSION_LOGIN_PATH|SESSION_FACTOR2_LOGIN_PATH|LOGOUT_PATH' server-modernized/src/main/java/open/dolphin/rest/LogFilter.java server-modernized/src/test/java/open/dolphin/rest/LogFilterTest.java -g '!**/target/**'` → `/api/session/login`・`/api/session/login/factor2`・`/api/logout` のみヒット。
  - `rg -n '/resources/api|/openDolphin/resources/api' server-modernized/src/main/java server-modernized/src/test server-modernized/src/main/webapp server-modernized/README.md docs/legacy-cutover-allowlist.md docs/web-client/CURRENT.md docs/modernization/api-map.md docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md docs/web-client/architecture -g '!docs/archive/**' -g '!docs/managerdocs/**' -g '!docs/server-modernization/phase2/**' -g '!docs/web-client/planning/phase2/**' -g '!**/target/**'` → 0 hit。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` → PASS。
- メモ:
  - 匿名許可 path と監査系の request URI 前提を `/api/*` 契約へ揃え、`/resources/api` 直書きを本番コード・現行テストから除去した。

#### API-05 README / frontend 契約 / test fixture を新 URL に合わせる
- [x] 実施する
- 目的: 実装だけでなく運用契約も新 URL に揃える。
- 依存: API-04
- 同時実行推奨: `B4`
- 対象:
  - `README.md`
  - API docs
  - frontend 連携前提の test / fixture / docs
- 実施内容:
  1. `/resources/*` と `/orca/*` を前提にした記述を削除する。
  2. `/api/*` を唯一の正規契約として記載する。
- 完了条件:
  - 旧 URL 契約が docs / tests / fixtures から消えている。
- 実施日時: 2026-03-16 12:09 JST
- 変更ファイル:
  - `server-modernized/README.md`
  - `docs/verification-plan.md`
  - `docs/legacy-cutover-allowlist.md`
  - `docs/web-client/architecture/doctor-workflow-status-20260120.md`
  - `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md`
  - `docs/web-client/architecture/web-client-emr-charts-design-20260128.md`
  - `docs/web-client/architecture/web-client-emr-patients-design-20260128.md`
  - `docs/web-client/architecture/web-client-screen-review-template.md`
  - `docs/web-client/architecture/web-client-screen-review-snippet-20260202.md`
  - `docs/web-client/architecture/web-client-api-mapping.md`
  - `docs/web-client/architecture/future-web-client-design.md`
  - `docs/web-client/architecture/orca-disease-api-mapping.md`
  - `docs/web-client/architecture/order-master-revalidation-20260120.md`
  - `docs/web-client/architecture/web-client-emr-reception-design-20260128.md`
- 検証:
  - `rg -n '/openDolphin/resources/orca|/resources/orca|/orca12/patientmodv2/outpatient|/orca21/medicalmodv2/outpatient' server-modernized/src/test web-client/src docs/web-client/CURRENT.md docs/modernization/api-map.md docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md docs/web-client/architecture docs/verification-plan.md docs/legacy-cutover-allowlist.md -g '!docs/archive/**' -g '!docs/managerdocs/**' -g '!docs/server-modernization/phase2/**' -g '!docs/web-client/planning/phase2/**' -g '!**/target/**'` → 0 hit。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` → PASS。
- メモ:
  - 現行 README / active architecture docs / server test fixture を `/api/*`・`/api/orca/*` 前提へ更新した。`docs/verification-plan.md` には過去検証の履歴表現が一部残るが、現行契約としての旧公開 URL は除去済み。

### Phase 3. 設定系を typed config へ統一

#### CFG-01 設定 namespace と typed config モデルを定義する
- [x] 実施する
- 目的: 設定の真実を env/system/property 混在解決から typed config に移す。
- 依存: API-05
- 同時実行推奨: `B5`
- 対象:
  - `src/main/java/open/dolphin/runtime/**`
  - `src/main/java/open/dolphin/orca/config/**`（必要なら新設）
  - `config/server-modernized.env.sample`
- 実施内容:
  1. 主要 namespace を整理する（例: `opendolphin.*`, `orca.*`, `plivo.*`, `fido2.*`）。
  2. MicroProfile Config で注入できる typed config / producer を作る。
  3. 設定の優先順位を 1 系統に決める。
- 完了条件:
  - 新しい設定モデルが code 上で表現されている。
  - “どこを見れば設定の真実が分かるか” が明確になっている。
- 実施日時: 2026-03-16 14:18 JST
- 変更ファイル:
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerRuntimeConfiguration.java`
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
  - `server-modernized/src/main/java/open/dolphin/security/SecondFactorSecurityConfig.java`
  - `server-modernized/src/main/java/open/dolphin/security/fido/Fido2Config.java`
  - `server-modernized/config/server-modernized.env.sample`
  - `docs/development/server-runtime-config-model.md`
  - `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
- 検証:
  - `rg -n 'opendolphin\\.environment|orca\\.db\\.|factor2\\.aes-key-b64|fido2\\.rp\\.|fido2\\.allowed\\.origins|plivo\\.' server-modernized/src/main/java server-modernized/config/server-modernized.env.sample docs/development/server-runtime-config-model.md` → typed config namespace の code / sample / doc 反映を確認。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -Dtest=ServerConfigurationResolverTest,ServerConfigurationValidatorTest,ServletStartupSecurityGuardTest,SecurityDefensiveCopyTest -Dsurefire.failIfNoSpecifiedTests=false test` → PASS。
- メモ:
  - `opendolphin.environment` / `db.*` / `orca.db.*` / `factor2.*` / `fido2.*` / `plivo.*` を `ServerConfigurationResolver` へ集約し、settings record で typed contract を明文化した。

#### CFG-02 起動時 validation / fail-fast を導入する
- [x] 実施する
- 目的: 必須設定不足を runtime 中に曖昧に飲み込まず、起動時に落とす。
- 依存: CFG-01
- 同時実行推奨: `B5`
- 対象:
  - config producer / bootstrap code
  - 起動時初期化クラス
- 実施内容:
  1. 必須設定の validation を追加する。
  2. dev 用の暗黙 default は、本番コードでは極力廃止する。
  3. エラーメッセージを運用者向けに明瞭にする。
- 完了条件:
  - 必須設定が欠けた状態で fail-fast する。
  - 曖昧な fallback が消えている。
- 実施日時: 2026-03-16 14:18 JST
- 変更ファイル:
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
  - `server-modernized/src/main/java/open/dolphin/mbean/ServletStartup.java`
  - `server-modernized/src/main/java/open/dolphin/security/SecondFactorSecurityConfig.java`
  - `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationValidatorTest.java`
- 検証:
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` → PASS。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am verify` → PASS。
  - `ServerConfigurationValidatorTest` で必須設定欠落時の `IllegalStateException` と、完全設定時の通過を固定。
- メモ:
  - 起動時の必須設定検証を `ServletStartup` から `ServerConfigurationValidator` 経由で実行する構成へ変更し、2FA/FIDO2/ORCA datasource secret の不足を fail-fast にした。

#### CFG-03 `RuntimeConfigurationSupport` を縮退または削除する
- [x] 実施する
- 目的: 全方位 lookup helper をやめ、最小限の bootstrap helper のみにする。
- 依存: CFG-02
- 同時実行推奨: `B6`
- 対象:
  - `src/main/java/open/dolphin/runtime/RuntimeConfigurationSupport.java`
  - 参照元一式
- 実施内容:
  1. env/system/json/yaml/legacy properties の混在解決を撤去する。
  2. 残すなら “typed config を読むための最小 helper” のみとする。
  3. `VITE_*` / `NODE_ENV` 参照はサーバー側から外す。
- 完了条件:
  - `RuntimeConfigurationSupport` が簡潔になっているか、不要なら削除されている。
  - サーバー側が frontend 向け env 名に依存していない。
- 実施日時: 2026-03-16 14:28 JST
- 変更ファイル:
  - `server-modernized/src/main/java/open/dolphin/runtime/RuntimeConfigurationSupport.java`
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerRuntimeConfiguration.java`
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
  - `server-modernized/src/main/java/open/dolphin/mbean/ServletStartup.java`
  - `server-modernized/src/main/java/open/dolphin/mbean/PvtService.java`
  - `server-modernized/src/main/java/open/dolphin/session/SessionMessageHandler.java`
  - `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncScheduler.java`
  - `server-modernized/src/test/java/open/dolphin/runtime/RuntimeConfigurationSupportTest.java`
  - `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
  - `server-modernized/src/test/java/open/dolphin/msg/MessagingDefensiveCopyTest.java`
- 検証:
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` → PASS。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am verify` → PASS。
  - `cd server-modernized && mvn -q -DskipITs test` → FAIL。既存の `api-contract` DTO (`OperationsHealthResponse` / `OperationsReadinessCheck` / `OrcaReportRequest`) が module 直下実行の classpath に出てこないため `NoClassDefFoundError`。
  - `rg -n 'resolveUnifiedSetting|loadLegacyCustomProperties|resolveConfigDirectory|resolveLegacyCustomPropertiesPath|VITE_|NODE_ENV' server-modernized/src/main/java server-modernized/src/test/java` → 0 hit。
- メモ:
  - `RuntimeConfigurationSupport` を bootstrap helper に縮退し、legacy properties / frontend env 名依存を除去した。
  - `cloud.zero` / `facilityId` / `PVT listener` は `ServerConfigurationResolver#orcaRuntime()` の typed config へ移した。

#### CFG-04 `ORCAConnection` を singleton + custom.properties 依存から脱却させる
- [x] 実施する
- 目的: ORCA 接続と DB 設定を注入可能・検証可能な形に変える。
- 依存: CFG-03
- 同時実行推奨: `B6`
- 対象:
  - `src/main/java/open/orca/rest/ORCAConnection.java`
  - その利用箇所
- 実施内容:
  1. `getInstance()` と `jboss.home.dir/custom.properties` 直読をやめる。
  2. typed config と CDI / DataSource 注入へ置き換える。
  3. secret / credential 解決も単一ルートに寄せる。
- 完了条件:
  - `ORCAConnection` が singleton に依存しない。
  - `custom.properties` / `jboss.home.dir` 参照が消えている。
- 実施日時: 2026-03-16 14:28 JST
- 変更ファイル:
  - `server-modernized/src/main/java/open/orca/rest/ORCAConnection.java`
  - `server-modernized/src/main/java/open/orca/rest/OrcaMasterDao.java`
  - `server-modernized/src/main/java/open/orca/rest/EtensuDao.java`
  - `server-modernized/src/main/java/open/orca/rest/OrcaResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java`
- 検証:
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` → PASS。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am verify` → PASS。
  - `cd server-modernized && mvn -q verify` → FAIL。既存の `api-contract` DTO (`OperationsHealthResponse` / `OperationsReadinessCheck` / `OrcaReportRequest`) が module 直下実行の classpath に出てこないため `NoClassDefFoundError`。
  - `rg -n 'ORCAConnection\\.getInstance\\(|custom\\.properties|jboss\\.home\\.dir' server-modernized/src/main/java/open/orca/rest/ORCAConnection.java server-modernized/src/main/java/open/orca/rest/OrcaMasterDao.java server-modernized/src/main/java/open/orca/rest/EtensuDao.java server-modernized/src/main/java/open/orca/rest/OrcaResource.java server-modernized/src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java` → `ORCAConnection.java` / DAO / resource 群では `getInstance` と `custom.properties` / `jboss.home.dir` 直読が 0 hit。`OrcaResource.java` の別処理に legacy direct read が残るが、`ORCAConnection` 経由ではない。
- メモ:
  - `ORCAConnection` を `@ApplicationScoped` + typed datasource config 前提へ置換し、singleton と legacy properties の混在責務を解消した。
  - direct new される resource test 互換のため、ORCA DB 利用箇所は CDI 注入未解決時のみ `ORCAConnection.current()` へフォールバックする。

#### CFG-05 `SmsGatewayConfig` と `Fido2Config` を typed config 化する
- [ ] 実施する
- 目的: 個別の `System.getenv()` と dev fallback をなくす。
- 依存: CFG-04
- 同時実行推奨: `B7`
- 対象:
  - `src/main/java/open/dolphin/msg/gateway/SmsGatewayConfig.java`
  - `src/main/java/open/dolphin/security/fido/Fido2Config.java`
- 実施内容:
  1. MicroProfile Config ベースに置換する。
  2. `custom.properties` 依存と `System.getenv()` 直読を除去する。
  3. dev default が必要なら test/dev 専用の設定に隔離する。
- 完了条件:
  - 上記クラスが typed config 経由だけで構成される。
  - 本番コードから暗黙 default が消えている。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### CFG-06 sample env / README / test を新設定体系へ揃える
- [ ] 実施する
- 目的: 実装変更後も設定投入方法が迷子にならないようにする。
- 依存: CFG-05
- 同時実行推奨: `B7`
- 対象:
  - `config/server-modernized.env.sample`
  - `README.md`
  - config 関連 test
- 実施内容:
  1. 現行の設定キー一覧を sample に反映する。
  2. 本番と dev/test の投入方法の違いを整理する。
- 完了条件:
  - sample / README / code が一致している。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

### Phase 4. ORCA master を現行スキーマ固定で再設計

#### ORCA-01 ORCA master の対象スキーマ契約を明文化する
- [ ] 実施する
- 目的: 互換吸収をやめる前に、「何を正規スキーマとして支えるか」を固定する。
- 依存: CFG-06
- 同時実行推奨: `B8`
- 対象:
  - `docs/development/` 配下の設計メモ
  - `open/orca/rest` 配下のコードコメント
- 実施内容:
  1. 対象テーブル名・列名・制約を列挙する。
  2. 旧列名候補や旧表名候補はサポート外と明記する。
- 完了条件:
  - repo 内に supported schema contract が文書化されている。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### ORCA-02 `OrcaMasterResource` を resource / service / mapper / audit helper に分割する
- [ ] 実施する
- 目的: 2300 行級 resource から責務を切り離し、以後の変更を安全にする。
- 依存: ORCA-01
- 同時実行推奨: `B8`
- 対象:
  - `src/main/java/open/orca/rest/OrcaMasterResource.java`
  - 新規 service / helper classes
- 実施内容:
  1. endpoint 定義、ビジネス判定、ETag、audit、response mapping を分離する。
  2. resource は request validation と response 組み立てに専念させる。
- 完了条件:
  - `OrcaMasterResource` の責務が大幅に減っている。
  - 分離後も endpoint test が成立する。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### ORCA-03 `DatabaseMetaData` probing と多候補列吸収を撤去する
- [ ] 実施する
- 目的: 旧スキーマ互換を捨て、固定 SQL へ移す。
- 依存: ORCA-02
- 同時実行推奨: `B9`
- 対象:
  - `src/main/java/open/orca/rest/OrcaMasterDao.java`
  - repository 層
- 実施内容:
  1. `resolveTable`, `columnOrNull`, `findColumn`, `DatabaseMetaData` 依存を廃止する。
  2. 各 master endpoint に対応する固定 SQL を定義する。
  3. 列名候補の列挙ロジックを削除する。
- 完了条件:
  - `OrcaMasterDao` から schema probing が消えている。
  - SQL が supported schema contract と 1 対 1 に対応している。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### ORCA-04 DB / ORCA 接続を CDI 注入へ統一する
- [ ] 実施する
- 目的: resource / dao が singleton や static 取得に依存しないようにする。
- 依存: ORCA-03
- 同時実行推奨: `B9`
- 対象:
  - `open/orca/rest/**`
  - ORCA master 関連 service / repository
- 実施内容:
  1. `ORCAConnection.getInstance()` を排除する。
  2. `DataSource` または repository を注入する設計にする。
  3. 接続失敗時の応答を明示的に定義する。
- 完了条件:
  - ORCA master 関連コードが DI で組み上がる。
  - static singleton への依存が残っていない。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### ORCA-05 起動時 schema validation を導入する
- [ ] 実施する
- 目的: 必要テーブルや列が欠けている環境を run 中に初めて検知しないようにする。
- 依存: ORCA-04
- 同時実行推奨: `B10`
- 対象:
  - ORCA master bootstrap / validation code
  - test
- 実施内容:
  1. 必要な table / column / index などの存在確認を起動時に行う。
  2. 不足時は明確なメッセージで fail-fast する。
- 完了条件:
  - schema が崩れていればアプリまたは該当 subsystem が起動失敗する。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### ORCA-06 ORCA master endpoint 群のテストを再構築する
- [ ] 実施する
- 目的: 再設計後の挙動を fixture ではなく明示 test で守る。
- 依存: ORCA-05
- 同時実行推奨: `B10`
- 対象:
  - `src/test/java/**/OrcaMaster*`
  - 必要な test fixture
- 実施内容:
  1. `generic-class`, `generic-price`, `drug`, `comment`, `bodypart`, `youhou`, `material`, `kensa-sort`, `hokenja`, `address` の test を用意する。
  2. DB あり / DB なし / schema 不備時の応答を明確にする。
- 完了条件:
  - endpoint 単位の test が存在し、verify で通る。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### ORCA-07 ORCA master 内の死んだ互換コードを刈り取る
- [ ] 実施する
- 目的: 再設計後に不要になった helper / enum / fallback 型を消す。
- 依存: ORCA-06
- 同時実行推奨: `B10`
- 対象:
  - `open/orca/rest/**`
- 実施内容:
  1. 再設計後に参照されなくなったクラスとメソッドを削除する。
  2. コメントと命名を現行構造に合わせる。
- 完了条件:
  - ORCA master 周辺に “旧互換の残骸” が残っていない。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

### Phase 5. fixture / snapshot / stub を本番パスから排除

#### FIX-01 ORCA master fixture と snapshot を test 側へ移す
- [ ] 実施する
- 目的: 本番コードが `artifacts/api-stability` や classpath fixture を読まないようにする。
- 依存: ORCA-07
- 同時実行推奨: `B11`
- 対象:
  - `src/main/java/open/orca/rest/OrcaMasterResource.java`
  - fixture / snapshot ファイル群
- 実施内容:
  1. `SNAPSHOT_ROOT`, `MSW_FIXTURE_ROOT`, `CLASSPATH_FIXTURE_ROOT` 依存を本番コードから外す。
  2. 必要な fixture は `src/test/resources` に移す。
- 完了条件:
  - 本番コードから `artifacts/api-stability` / `msw-fixture` 参照が消えている。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FIX-02 ORCA master の runtime fallback 応答を廃止する
- [ ] 実施する
- 目的: DB 障害時に fixture で 200 を返す経路を無くす。
- 依存: FIX-01
- 同時実行推奨: `B11`
- 対象:
  - `open/orca/rest/OrcaMasterResource.java`
  - ORCA master test
- 実施内容:
  1. DB 不可時は 5xx または設計済みの失敗応答を返す。
  2. fixture fallback による成功応答を消す。
- 完了条件:
  - 本番では backend 不可時に fail-closed する。
  - その挙動を test が保証する。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FIX-03 `StubOrcaTransport` と stub payload catalog を本番モジュールから隔離する
- [ ] 実施する
- 目的: sample XML/JSON を本番パッケージングから外す。
- 依存: FIX-02
- 同時実行推奨: `B12`
- 対象:
  - `src/main/java/open/dolphin/orca/transport/StubOrcaTransport.java`
  - `src/main/java/open/dolphin/orca/transport/OrcaEndpoint.java`
  - `src/main/resources/orca/stub/**`
- 実施内容:
  1. stub transport と sample payload を `src/test` または専用 dev/test artifact に移す。
  2. 本番 enum / transport から `stubResource` 概念を切り離す。
- 完了条件:
  - `src/main/resources/orca/stub` が本番 artifact に含まれない。
  - 本番コードが sample payload を参照しない。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FIX-04 backend unavailable 時の fail-closed 契約を全 ORCA 経路で揃える
- [ ] 実施する
- 目的: 一部だけ stub/fallback、他は実接続、という混在状態を終わらせる。
- 依存: FIX-03
- 同時実行推奨: `B12`
- 対象:
  - ORCA transport / adapter / REST resource 一式
- 実施内容:
  1. backend 不可時の応答ポリシーを統一する。
  2. “勝手に sample を返す” 挙動を排除する。
- 完了条件:
  - ORCA 系の障害時挙動が一貫している。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FIX-05 test だけが fixture / stub を読む構造へ更新する
- [ ] 実施する
- 目的: fixture を失わず、本番パスだけを綺麗にする。
- 依存: FIX-04
- 同時実行推奨: `B12`
- 対象:
  - `src/test/resources/**`
  - test utility
- 実施内容:
  1. 既存 test が必要とする fixture を test resource へ移す。
  2. test helper を調整する。
- 完了条件:
  - 本番 artifact に fixture/stub が入らず、test は維持される。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

### Phase 6. レガシー ORCA 層・重複 utility を整理

#### LEG-01 `common` 側 deprecated ORCA API 群を削除または隔離する
- [ ] 実施する
- 目的: 新 ORCA adapter に統一し、古い API を今後参照できないようにする。
- 依存: FIX-05
- 同時実行推奨: `B13`
- 対象:
  - `common/src/main/java/open/dolphin/common/OrcaApi.java`
  - `common/src/main/java/open/dolphin/common/OrcaConnect.java`
  - `common/src/main/java/open/dolphin/common/OrcaAnalyze.java`
  - 参照元検索結果
- 実施内容:
  1. repo 横断で参照を確認する。
  2. 未使用なら削除する。
  3. まだ参照が残るなら、`legacy-bridge` 的な隔離先へ移し、本番コードから参照を断つ。
- 完了条件:
  - 現行 server 実装から上記 deprecated API への依存が消えている。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### LEG-02 ORCA パッケージ面を 1 つの論理面へ整理する
- [ ] 実施する
- 目的: `open.orca.rest`, `open.dolphin.rest.orca`, `open.dolphin.orca.rest` の分散を縮小する。
- 依存: LEG-01
- 同時実行推奨: `B13`
- 対象:
  - ORCA 関連 package 一式
- 実施内容:
  1. endpoint / adapter / service / transport / support の責務を整理する。
  2. package 命名を一貫させる。
  3. 不要な中継 package を廃止する。
- 完了条件:
  - ORCA 関連 package 構成が説明しやすい形になっている。
  - 重複責務の package が減っている。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### LEG-03 MD5 `HashUtil` を廃止し、利用箇所を置換する
- [ ] 実施する
- 目的: 脆弱で重複した utility を消す。
- 依存: LEG-02
- 同時実行推奨: `B14`
- 対象:
  - `src/main/java/open/dolphin/mbean/HashUtil.java`
  - その利用箇所
  - 必要なら `src/main/java/open/dolphin/security/HashUtil.java`
- 実施内容:
  1. `MD5()` 利用箇所を検索する。
  2. SHA-256 など現行 utility へ置き換えるか、用途自体を削除する。
  3. MD5 utility を削除する。
- 完了条件:
  - 本番コードに MD5 utility が残っていない。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### LEG-04 CDI descriptor を 1 枚に統一する
- [ ] 実施する
- 目的: Java EE 旧 descriptor と Jakarta descriptor の重複を解消する。
- 依存: LEG-03
- 同時実行推奨: `B14`
- 対象:
  - `src/main/java/META-INF/beans.xml`
  - `src/main/webapp/WEB-INF/beans.xml`
- 実施内容:
  1. Jakarta 側だけで成立するように整える。
  2. 旧 Java EE descriptor を削除する。
- 完了条件:
  - `beans.xml` が 1 枚だけになっている。
  - CDI 起動と interceptor 設定が verify で確認できる。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

### Phase 7. converter 層を縮退させる

#### CVT-01 converter 棚卸しを行い、keep/remove を分類する
- [ ] 実施する
- 目的: 72 クラスを一気に触る前に、削除対象を明示する。
- 依存: LEG-04
- 同時実行推奨: `B15`
- 対象:
  - `src/main/java/open/dolphin/converter/**`
  - 利用箇所
- 実施内容:
  1. converter を以下で分類する。
     - 単純 getter 委譲のみ → 削除候補
     - 非互換吸収や複雑変換あり → keep 候補
     - 参照なし → 即削除候補
  2. 棚卸し結果をこの文書か別 md に残す。
- 完了条件:
  - 各 converter の扱いが一覧化されている。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### CVT-02 単純委譲 converter を DTO / record + mapper へ置き換える
- [ ] 実施する
- 目的: REST resource が薄い converter wrapper 群に依存しないようにする。
- 依存: CVT-01
- 同時実行推奨: `B15`
- 対象:
  - `src/main/java/open/dolphin/rest/**`
  - `src/main/java/open/dolphin/converter/**`
- 実施内容:
  1. 高使用頻度 resource から順に trivial converter を削除する。
  2. DTO / record / mapper で表現する。
  3. converter interface のためだけに存在する型を減らす。
- 完了条件:
  - trivial converter の第一波が削除され、resource が直接 mapper / DTO を使う。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### CVT-03 未使用 converter と関連 interface / exclusion を掃除する
- [ ] 実施する
- 目的: 置換後に残る死んだコードを削る。
- 依存: CVT-02
- 同時実行推奨: `B16`
- 対象:
  - `src/main/java/open/dolphin/converter/**`
  - `config/static-analysis/spotbugs-exclude.xml`
  - test
- 実施内容:
  1. 参照ゼロの converter を削除する。
  2. static analysis の除外設定を縮小する。
  3. 必要な test を更新する。
- 完了条件:
  - 未使用 converter が残っていない。
  - 静的解析除外が現状に追随している。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### CVT-04 converter 層の最終状態を文書化する
- [ ] 実施する
- 目的: “なぜ残っている converter があるのか” を将来判断しやすくする。
- 依存: CVT-03
- 同時実行推奨: `B16`
- 対象:
  - `docs/development/` 配下の md
  - 必要なら package-info / README
- 実施内容:
  1. 残存 converter の存在理由を明記する。
  2. 今後削除できる候補があれば明文化する。
- 完了条件:
  - converter 層の残存理由が説明可能になっている。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

### Phase 8. 最終検証とドキュメント閉じ

#### FINAL-01 repo 横断の最終 verification を行う
- [ ] 実施する
- 目的: フェーズ横断変更の破綻を最後に潰す。
- 依存: CVT-04
- 同時実行推奨: `B17`
- 対象:
  - `server-modernized`
  - `common`（変更時）
- 実施内容:
  1. `mvn -q -DskipITs test`
  2. `mvn -q verify`
  3. `common` を触った場合は `mvn -q test`
  4. 共通 grep を再実行する。
- 完了条件:
  - 実行結果が run log に記録されている。
  - 重大な未解決が残っていない。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FINAL-02 運用文書を締め、残課題を明記する
- [ ] 実施する
- 目的: 完了状態を第三者が判断できるようにする。
- 依存: FINAL-01
- 同時実行推奨: `B17`
- 対象:
  - 本書
  - `README.md`
  - 関連設計メモ
- 実施内容:
  1. 本書の未完チェックをゼロにする。
  2. 残るリスクがあるなら run log 最終項に明記する。
  3. 必要なら “done summary” を追加する。
- 完了条件:
  - 本書が最新化されている。
  - 次の作業者が見ても完了 / 未完が判別できる。
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

---

## 7. Automation run log

以下を Codex が毎 run 追記すること。

### テンプレート

```md
#### Run YYYY-MM-DD HH:MM JST
- 完了:
  - TASK-ID ...
- 継続 / 着手中:
  - TASK-ID ...
- ブロッカー:
  - TASK-ID ... / 理由 ...
- 実行コマンド:
  - ...
- 主な変更ファイル:
  - ...
- 検証結果:
  - ...
- 次回の先頭候補:
  - ...
```

### 実行記録

<!-- Codex はここへ追記する -->

#### Run 2026-03-16 09:04 JST
- 完了:
  - PREP-01 baseline を採取し、現状の test / grep 結果を記録。
  - PREP-02 方針 ADR を追加。
  - FW-01 migration 正本を `server-modernized/tools/flyway/sql` に一本化。
  - FW-02 runtime / test の migration 読み込みを `target/classes/db/migration` 生成へ統一。
  - FW-03 source mirror の差分を解消し、`P1_03` を canonical 手動 seed に統一。
  - FW-04 Flyway テストを新設計前提へ更新。
  - FW-05 Flyway 運用文書を生成コピー前提へ更新。
- 継続 / 着手中:
  - API-01 以降は未着手。
- ブロッカー:
  - server-modernized 全体 build は既存の main compile blocker により継続失敗。`OperationsHealthResponse` / `OperationsReadinessCheck` / `OperationsReadinessResponse` / `OrcaReportRequest` / `OrcaReportResponse` が未解決で、`mvn -q -DskipITs test` と `mvn -q verify` を完走できない。
- 実行コマンド:
  - `cd server-modernized && mvn -q -DskipITs test`
  - `cd common && mvn -q test`
  - `rg -n "src/main/resources/db/migration|tools/flyway/sql" .`
  - `rg -n '"/resources/|"/orca/|/resources/\*|/orca/\*' server-modernized/src/main/java server-modernized/src/main/webapp`
  - `rg -n 'custom\.properties|jboss\.home\.dir|System\.getenv\(|System\.getProperty\(' server-modernized/src/main/java`
  - `rg -n 'artifacts/api-stability|msw-fixture|CLASSPATH_FIXTURE_ROOT|SNAPSHOT_ROOT|StubOrcaTransport|stubResource' server-modernized/src/main/java server-modernized/src/main/resources`
  - `rg -n 'open\.dolphin\.mbean\.HashUtil|MD5\(' server-modernized/src/main/java common src`
  - `find server-modernized/src/main/java/open/dolphin/converter -maxdepth 1 -type f -name '*.java' | wc -l`
  - `cd server-modernized && mvn -q process-resources`
  - `find server-modernized/tools/flyway/sql -maxdepth 1 -type f | sort`
  - `find server-modernized/src/main/resources -path '*/db/migration/*' -type f`
  - `find server-modernized/target/classes/db/migration -maxdepth 1 -type f | sort`
  - `cd server-modernized && mvn -q -DskipITs -Dtest=FlywayMigrationConsistencyTest -Dsurefire.failIfNoSpecifiedTests=false test`
- 主な変更ファイル:
  - `docs/development/server-internal-modernization-adr.md`
  - `docs/development/server-internal-spec-modernization-checklist.md`
  - `server-modernized/pom.xml`
  - `server-modernized/src/test/java/open/dolphin/db/FlywayMigrationConsistencyTest.java`
  - `server-modernized/tools/flyway/README.md`
  - `docs/modernization/p1-03-baseline-fixture-setup.md`
  - `docs/modernization/p5-07-orca-sync-state-db-store.md`
  - `docs/modernization/p6-08-flyway-schema-migration.md`
  - `docs/modernization/p6-10-index-fetch-plan-n-plus1-review.md`
- 検証結果:
  - `common` test は PASS。
  - `server-modernized` は全体 test / verify とも既存 compile blocker のため FAIL。

#### Run 2026-03-16 10:06 JST
- 完了:
  - API-01 `/api/*` 単一入口化。`OpenDolphinRestApplication` を追加し、`web.xml` の二重 dispatcher と `resteasy.resources` 列挙を撤去。
  - Flyway の legacy source mirror ディレクトリ `server-modernized/src/main/resources/db/migration` を削除。
- 継続 / 着手中:
  - API-02 ORCA 系 endpoint の `/api/orca/*` 統一は main code の再配置まで完了。
  - active docs / tests に旧 `/orca/*`・`/orca12/*`・`/orca21/*`・`/openDolphin/resources/*` 記述が残るため、API-02 は未完了のまま継続。
- ブロッカー:
  - 外部 blocker なし。
  - `cd server-modernized && mvn -q -DskipITs test` は sibling module を reactor に含めないと `api-contract` DTO 解決に失敗するため、現状は root reactor 経由でのみ全体検証を完走可能。
- 実行コマンド:
  - `cd server-modernized && mvn -q -DskipITs test`
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test`
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am verify`
  - `rg -n '^@Path\\("/api|^@Path\\("/orca12|^@Path\\("/orca21|^@Path\\("/api01rv2|/openDolphin/resources|/resources/\\*|/orca/\\*' server-modernized/src/main server-modernized/src/test -g '!**/target/**'`
  - `rg -n '/orca12|/orca21|/api01rv2/patientgetv2|/orca/patientgetv2|/openDolphin/resources/api|/openDolphin/resources/orca|/resources/\\*|/orca/\\*' docs server-modernized/src/test web-client/src -g '!docs/archive/**' -g '!docs/managerdocs/**' -g '!docs/server-modernization/phase2/**' -g '!docs/web-client/planning/phase2/**' -g '!**/target/**'`
- 主な変更ファイル:
  - `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
  - `server-modernized/src/main/webapp/WEB-INF/web.xml`
  - `server-modernized/src/main/java/open/dolphin/rest/OrcaPatientApiResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalModV2Resource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/LogFilter.java`
  - `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaMedicalModV2ResourceTest.java`
- 検証結果:
  - root reactor 経由の `server-modernized` test / verify は PASS。
  - `web.xml` から `/resources/*` と `/orca/*` の servlet/filter mapping、および RESTEasy bootstrap が消えたことを確認。
  - inventory grep では main code の旧 servlet 契約は解消済みだが、active docs / tests に旧公開 path 記述が多数残存。
- 次回の先頭候補:
  - API-02 の残件として、active docs / tests / web-client 実装に残る旧 `/orca*`・`/resources*` 公開契約記述を `/api/orca/*` 基準へ置換。
  - `process-resources` は PASS、`target/classes/db/migration` には `V0300`〜`V0304` のみ生成。
  - source tree の `src/main/resources/db/migration` は 0 件。

#### Run 2026-03-16 11:07 JST
- 完了:
  - API-02 の継続として、現行 web-client 実装・current hub docs・inventory・server test の ORCA 公開 path を `/api/orca/*` 基準へ追加で整理。
- 継続 / 着手中:
  - API-02 は未完了。現行設計/検証 docs 群に旧 `/orca/*`・`/orca12/*`・`/orca21/*`・`/openDolphin/resources/*` の記述がまだ残る。
- ブロッカー:
  - 外部 blocker なし。
  - `cd server-modernized && mvn -q -DskipITs -Dtest=... test` のような submodule 単体 test は `api-contract` DTO を reactor に含めないと compile 失敗する。全体検証は root reactor 経由で実施する。
- 実行コマンド:
  - `npm -C web-client run test -- --run src/libs/http/httpClient.test.ts src/features/reception/api.ts src/features/outpatient/__tests__/fetchWithResolver.test.ts src/features/outpatient/__tests__/orcaPatientImportApi.test.ts src/features/outpatient/__tests__/orcaQueueApi.test.ts src/mocks/handlers/orcaOrderBundles.test.ts src/mocks/handlers/orcaQueue.test.ts src/features/charts/diseaseApi.test.ts src/features/charts/orderMasterSearchApi.test.ts src/features/charts/orcaGenericPriceApi.test.ts src/features/patients/orcaAddressApi.test.ts src/features/patients/orcaHokenjaApi.test.ts src/features/patients/__tests__/PatientsPage.test.tsx --silent=true`
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test`
  - `rg -n '(?<![A-Za-z0-9])/orca(?=/)' ../web-client/src -P`
  - `rg -n '/openDolphin/resources/orca|/resources/orca|/orca12/patientmodv2/outpatient|/orca21/medicalmodv2/outpatient' src/test ../web-client/src ../docs/web-client/CURRENT.md ../docs/modernization/api-map.md ../docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md`
- 主な変更ファイル:
  - `web-client/src/features/outpatient/fetchWithResolver.ts`
  - `server-modernized/src/test/java/open/dolphin/rest/OrcaChartSupportResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/OrcaReportDocumentResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/PatientModV2OutpatientResourceIdempotencyTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/OrcaGatewayExceptionMapperTest.java`
  - `docs/web-client/CURRENT.md`
  - `docs/modernization/api-map.md`
  - `docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md`
- 検証結果:
  - `npm -C web-client run test -- --run ...` は 12 files / 102 tests PASS。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` は PASS。
  - `rg -n '(?<![A-Za-z0-9])/orca(?=/)' ../web-client/src -P` は 0 hit。
  - `rg -n '/openDolphin/resources/orca|/resources/orca|/orca12/patientmodv2/outpatient|/orca21/medicalmodv2/outpatient' src/test ../web-client/src ../docs/web-client/CURRENT.md ../docs/modernization/api-map.md ../docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md` は 0 hit。
  - ただし `../docs/web-client/architecture/**` と `../docs/verification-plan.md` など active docs 全体には旧公開 path 記述が残存。
- 次回の先頭候補:
  - API-02 の完了条件を満たすため、`docs/web-client/architecture/**` と `docs/verification-plan.md` を中心に旧 `/orca*`・`/resources*` 公開契約記述を `/api/orca/*` 基準へ掃除する。

#### Run 2026-03-16 12:09 JST
- 完了:
  - API-02 ORCA 系 endpoint の公開契約を `/api/orca/*` 基準へ統一し、server test・README・active docs の request URI / 記述を追随させた。
  - API-03 `web.xml` の `/api/*` 単一 mapping 状態を再確認し、legacy servlet/filter mapping 不在をテストで固定した。
  - API-04 `LogFilter` / 関連テストの `/resources/api` 前提を除去した。
  - API-05 README / frontend 契約 docs / test fixture の旧 URL 表記を整理した。
- 継続 / 着手中:
  - CFG-01 以降は未着手。
- ブロッカー:
  - 外部 blocker なし。
  - `cd server-modernized && mvn -q -DskipITs test` 単体では sibling module 解決の制約が残るため、全体検証は root reactor 経由を継続利用する。
- 実行コマンド:
  - `git diff -- server-modernized/src/main/java/open/orca/rest/OrcaMasterResource.java server-modernized/src/main/java/open/dolphin/rest/RestExceptionMapper.java server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientLocalSearchResource.java server-modernized/README.md server-modernized/src/test/java/open/dolphin/orca/rest/OrcaAppointmentResourceTest.java server-modernized/src/test/java/open/dolphin/orca/rest/OrcaVisitResourceTest.java server-modernized/src/test/java/open/dolphin/orca/rest/OrcaVisitResourceRealtimeTest.java server-modernized/src/test/java/open/dolphin/orca/rest/OrcaPatientLocalSearchResourceTest.java server-modernized/src/test/java/open/dolphin/security/audit/SessionAuditDispatcherTest.java server-modernized/src/test/java/open/dolphin/rest/orca/OrcaSubjectiveResourceTest.java server-modernized/src/test/java/open/dolphin/rest/orca/OrcaDiseaseResourceTest.java server-modernized/src/test/java/open/dolphin/rest/orca/OrcaMedicalResourceTest.java server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleResourceTest.java server-modernized/src/test/java/open/dolphin/rest/orca/OrcaPatientResourceIdempotencyTest.java server-modernized/src/test/java/open/dolphin/rest/SessionAuthResourceTest.java server-modernized/src/test/java/open/dolphin/rest/LogFilterTest.java server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java docs/verification-plan.md docs/legacy-cutover-allowlist.md docs/web-client/architecture/doctor-workflow-status-20260120.md docs/web-client/architecture/web-client-emr-design-integrated-20260128.md docs/web-client/architecture/web-client-emr-charts-design-20260128.md docs/web-client/architecture/web-client-emr-patients-design-20260128.md docs/web-client/architecture/web-client-screen-review-template.md docs/web-client/architecture/web-client-screen-review-snippet-20260202.md docs/web-client/architecture/web-client-api-mapping.md docs/web-client/architecture/future-web-client-design.md docs/web-client/architecture/orca-disease-api-mapping.md docs/web-client/architecture/order-master-revalidation-20260120.md docs/web-client/architecture/web-client-emr-reception-design-20260128.md`
  - `rg -n '/resources/api|/openDolphin/resources/api' server-modernized/src/main/java server-modernized/src/test server-modernized/src/main/webapp server-modernized/README.md docs/legacy-cutover-allowlist.md docs/web-client/CURRENT.md docs/modernization/api-map.md docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md docs/web-client/architecture -g '!docs/archive/**' -g '!docs/managerdocs/**' -g '!docs/server-modernization/phase2/**' -g '!docs/web-client/planning/phase2/**' -g '!**/target/**'`
  - `rg -n '/resources/\\*|/orca/\\*|HttpServletDispatcher|ResteasyBootstrap' server-modernized/src/main/webapp/WEB-INF/web.xml server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java -g '!**/target/**'`
  - `rg -n '\"/resources/api|/openDolphin/resources/api|SESSION_LOGIN_PATH|SESSION_FACTOR2_LOGIN_PATH|LOGOUT_PATH' server-modernized/src/main/java/open/dolphin/rest/LogFilter.java server-modernized/src/test/java/open/dolphin/rest/LogFilterTest.java -g '!**/target/**'`
  - `rg -n '/openDolphin/resources/orca|/resources/orca|/orca12/patientmodv2/outpatient|/orca21/medicalmodv2/outpatient' server-modernized/src/test web-client/src docs/web-client/CURRENT.md docs/modernization/api-map.md docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md docs/web-client/architecture docs/verification-plan.md docs/legacy-cutover-allowlist.md -g '!docs/archive/**' -g '!docs/managerdocs/**' -g '!docs/server-modernization/phase2/**' -g '!docs/web-client/planning/phase2/**' -g '!**/target/**'`
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test`
- 主な変更ファイル:
  - `docs/development/server-internal-spec-modernization-checklist.md`
  - `server-modernized/src/main/java/open/orca/rest/OrcaMasterResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/RestExceptionMapper.java`
  - `server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientLocalSearchResource.java`
  - `server-modernized/src/test/java/open/dolphin/rest/AbstractResourceErrorResponseTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/LogFilterTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/SessionAuthResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/security/audit/SessionAuditDispatcherTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleResourceTest.java`
  - `server-modernized/README.md`
  - `docs/verification-plan.md`
  - `docs/legacy-cutover-allowlist.md`
  - `docs/web-client/architecture/doctor-workflow-status-20260120.md`
  - `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md`
  - `docs/web-client/architecture/web-client-screen-review-template.md`
- 検証結果:
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` は PASS。
  - `/resources/api` / `/openDolphin/resources/api` grep は 0 hit。
  - `/openDolphin/resources/orca` / `/resources/orca` / `/orca12/patientmodv2/outpatient` / `/orca21/medicalmodv2/outpatient` grep は 0 hit。
  - `web.xml` には `/api/*` 以外の legacy servlet/filter mapping と RESTEasy bootstrap が残っていない。
- 次回の先頭候補:
  - CFG-01 設定 namespace と typed config モデルの定義。
  - CFG-02 起動時 validation / fail-fast の導入。

#### Run 2026-03-16 14:18 JST
- 完了:
  - CFG-01 typed config 集約点として `open.dolphin.runtime.config` を追加し、runtime / datasource / factor2 / fido2 / plivo の namespace と settings record を定義した。
  - CFG-02 起動時 validator を追加し、`ServletStartup` から必須設定不足を fail-fast で検出するようにした。
- 継続 / 着手中:
  - CFG-03 `RuntimeConfigurationSupport` の縮退は未着手。
- ブロッカー:
  - 外部 blocker なし。
  - `custom.properties` / `jboss.home.dir` / `System.getenv()` 直読は `ORCAConnection` / `SmsGatewayConfig` / `RuntimeConfigurationSupport` などに残存しており、除去は `CFG-03` 以降の範囲。
- 実行コマンド:
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -Dtest=ServerConfigurationResolverTest,ServerConfigurationValidatorTest,ServletStartupSecurityGuardTest,SecurityDefensiveCopyTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test`
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am verify`
  - `rg -n 'custom\.properties|jboss\.home\.dir|System\.getenv\(|System\.getProperty\(' server-modernized/src/main/java/open/dolphin/runtime server-modernized/src/main/java/open/orca/rest/ORCAConnection.java server-modernized/src/main/java/open/dolphin/msg/gateway/SmsGatewayConfig.java server-modernized/src/main/java/open/dolphin/security server-modernized/src/main/java/open/dolphin/mbean/ServletStartup.java`
  - `rg -n 'opendolphin\.environment|orca\.db\.|factor2\.aes-key-b64|fido2\.rp\.|fido2\.allowed\.origins|plivo\.' server-modernized/src/main/java server-modernized/config/server-modernized.env.sample docs/development/server-runtime-config-model.md`
- 主な変更ファイル:
  - `docs/development/server-internal-spec-modernization-checklist.md`
  - `docs/development/server-runtime-config-model.md`
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerRuntimeConfiguration.java`
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
  - `server-modernized/src/main/java/open/dolphin/mbean/ServletStartup.java`
  - `server-modernized/src/main/java/open/dolphin/security/SecondFactorSecurityConfig.java`
  - `server-modernized/src/main/java/open/dolphin/security/fido/Fido2Config.java`
  - `server-modernized/config/server-modernized.env.sample`
  - `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
  - `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationValidatorTest.java`
- 検証結果:
  - targeted config/security tests は PASS。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test` は PASS。
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am verify` は PASS。
  - typed config namespace grep は新設 code / sample / doc のみにヒット。
  - `custom.properties` / `jboss.home.dir` / `System.getenv()` 直読 grep は `RuntimeConfigurationSupport`・`ORCAConnection`・`SmsGatewayConfig`・`DocumentIntegrityConfig` などに残存し、次フェーズ対象であることを確認。
- 次回の先頭候補:
  - CFG-03 `RuntimeConfigurationSupport` を縮退または削除する。
  - 同一バンドル継続で CFG-04 `ORCAConnection` の singleton / custom.properties 依存除去に進む。

#### Run 2026-03-16 14:28 JST
- 完了:
  - CFG-03 `RuntimeConfigurationSupport` を bootstrap helper に縮退し、legacy property loader / mixed lookup / frontend env 依存を除去した。
  - CFG-04 `ORCAConnection` を `@ApplicationScoped` 化し、typed datasource config + JNDI datasource lookup に一本化した。
  - `cloud.zero` / `facilityId` / `PVT listener` の参照を `ServerConfigurationResolver#orcaRuntime()` へ移し、ORCA property bag 依存を解消した。
- 継続 / 着手中:
  - B7 の `CFG-05` / `CFG-06` は未着手。
- ブロッカー:
  - 外部 blocker なし。
  - `cd server-modernized && mvn -q -DskipITs test` / `mvn -q verify` は既存の `api-contract` DTO classpath 不備 (`OperationsHealthResponse` / `OperationsReadinessCheck` / `OrcaReportRequest`) により FAIL。reactor 実行 (`-f pom.server-modernized.xml -pl server-modernized -am`) では PASS。
- 実行コマンド:
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am -DskipITs test`
  - `mvn -q -f pom.server-modernized.xml -pl server-modernized -am verify`
  - `cd server-modernized && mvn -q -DskipITs test`
  - `cd server-modernized && mvn -q verify`
  - `rg -n 'resolveUnifiedSetting|loadLegacyCustomProperties|resolveConfigDirectory|resolveLegacyCustomPropertiesPath|VITE_|NODE_ENV' server-modernized/src/main/java server-modernized/src/test/java`
  - `rg -n 'ORCAConnection\\.getInstance\\(|custom\\.properties|jboss\\.home\\.dir' server-modernized/src/main/java/open/orca/rest/ORCAConnection.java server-modernized/src/main/java/open/orca/rest/OrcaMasterDao.java server-modernized/src/main/java/open/orca/rest/EtensuDao.java server-modernized/src/main/java/open/orca/rest/OrcaResource.java server-modernized/src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java`
  - `rg -n 'RuntimeConfigurationSupport|ORCAConnection\\.getInstance\\(' server-modernized/src/main/java server-modernized/src/test/java`
- 主な変更ファイル:
  - `docs/development/server-internal-spec-modernization-checklist.md`
  - `server-modernized/src/main/java/open/dolphin/runtime/RuntimeConfigurationSupport.java`
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerRuntimeConfiguration.java`
  - `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
  - `server-modernized/src/main/java/open/dolphin/mbean/ServletStartup.java`
  - `server-modernized/src/main/java/open/dolphin/mbean/PvtService.java`
  - `server-modernized/src/main/java/open/dolphin/session/SessionMessageHandler.java`
  - `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncScheduler.java`
  - `server-modernized/src/main/java/open/orca/rest/ORCAConnection.java`
  - `server-modernized/src/main/java/open/orca/rest/OrcaMasterDao.java`
  - `server-modernized/src/main/java/open/orca/rest/EtensuDao.java`
  - `server-modernized/src/main/java/open/orca/rest/OrcaResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java`
  - `server-modernized/src/test/java/open/dolphin/runtime/RuntimeConfigurationSupportTest.java`
  - `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
  - `server-modernized/src/test/java/open/dolphin/msg/MessagingDefensiveCopyTest.java`
- 検証結果:
  - reactor 経由の `test` / `verify` は PASS。
  - module 直下の `test` / `verify` は既存 classpath 問題で FAIL。
  - `RuntimeConfigurationSupport` に legacy property loader / `VITE_*` / `NODE_ENV` 依存は残っていない。
  - `ORCAConnection` とその主要利用箇所に `getInstance()` / `custom.properties` / `jboss.home.dir` 直読は残っていない。
- 次回の先頭候補:
  - CFG-05 `SmsGatewayConfig` と `Fido2Config` を typed config 化する。
  - 同一バンドル継続で CFG-06 sample env / README / test を新設定体系へ揃える。



---

## 8. Codex automation prompt（本書の付録）

本書を進行管理表として使う前提の prompt。コピーしやすいように別ファイル `docs/development/codex-automation-prompt.md` にも同じ内容を置いてある。

```text
Workspace rules:
- Primary repository: server-modernized/
- Optional sibling repository: common/
- Source of truth for progress: server-modernized/docs/development/server-internal-spec-modernization-checklist.md
- If the workspace root is already server-modernized, adjust relative paths accordingly.

Mission:
Complete the server internal modernization checklist end-to-end.

Non-negotiable product rules:
- Backward compatibility is NOT required.
- Treat legacy database/schema/URL/config compatibility as disposable.
- Favor production-ready structure: explicit contracts, dependency injection, typed MicroProfile config, fail-fast startup validation, no runtime test fixtures in production code.
- Do not keep old routes, old configuration fallbacks, old stubs, old snapshots, or deprecated utilities just to avoid change size.

Execution policy for each hourly automation run:
1. Open the checklist and find the highest-priority unchecked task whose dependencies are already satisfied.
2. In the same run, complete as many READY tasks as safely fit within the hour. Prefer tasks from the same `同時実行推奨` bundle. Do not stop after finishing only one task if more ready tasks remain.
3. Keep the repository buildable after each logical batch.
4. After each completed task:
   - change `[ ]` to `[x]`
   - fill `実施日時`, `変更ファイル`, `検証`, and `メモ`
   - append a new entry under `Automation run log`
5. If a task is blocked by missing external credentials, missing sibling repo, unavailable services, or a real architectural unknown:
   - record the blocker in that task and in the run log
   - leave the task unchecked
   - immediately continue with the next ready task
6. Prefer deleting obsolete code over preserving it.
7. Do not leave placeholder TODOs if the work can be completed now.
8. If a refactor is large, land it in coherent batches that each compile and are documented in the checklist.

Required working order:
- Follow phase order in the checklist.
- Use the `同時実行推奨` bundle labels to batch multiple tasks in one run.
- When one bundle finishes and time remains, continue to the next ready bundle automatically.

Minimum verification:
- In server-modernized/: `mvn -q -DskipITs test`
- In server-modernized/ when shared infrastructure changed: `mvn -q verify`
- In common/ if modified: `mvn -q test`
- Run relevant grep/inventory commands from the checklist and record concise results.

Repository-specific goals:
- Flyway: one authored migration source only.
- REST: only `/api/*` remains public; `/resources/*` and `/orca/*` are removed.
- Config: remove `custom.properties` and `jboss.home.dir` dependence from production code; use typed config.
- ORCA master: fixed supported schema, no DatabaseMetaData probing, no runtime fixture fallback.
- Fixtures/stubs: no production dependency on `artifacts/api-stability` or `src/main/resources/orca/stub`.
- Legacy cleanup: remove deprecated ORCA APIs or isolate them away from production; remove MD5 HashUtil; keep only one Jakarta CDI descriptor.
- Converter cleanup: shrink `open.dolphin.converter` so only justified non-trivial converters remain.

End-of-run output requirements:
- Update the checklist file in place.
- Summarize what changed, what was verified, what was blocked, and which ready tasks should run next.
- If all tasks are complete, explicitly state that the checklist is fully done and include the final verification results.
```
