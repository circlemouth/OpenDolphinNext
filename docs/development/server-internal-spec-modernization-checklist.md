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
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### PREP-02 実装方針の ADR を作る
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

### Phase 1. Flyway migration を単一正本へ集約

#### FW-01 migration 正本を 1 つに決め、著者管理ディレクトリを一本化する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FW-02 runtime / test から見える migration 読み込み経路を再設計する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FW-03 不一致 migration を解消し、差分を一掃する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FW-04 Flyway テストを単一正本前提へ作り替える
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### FW-05 Flyway の運用文書とスクリプトを現行化する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

### Phase 2. REST 入口を `/api/*` に統一

#### API-01 JAX-RS の正式な入口を `/api` に固定する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### API-02 ORCA 系 resource を `/api/orca/*` に再配置する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### API-03 `web.xml` の二重 servlet / filter mapping を整理する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### API-04 `LogFilter` と関連 filter の path ハードコードを除去する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### API-05 README / frontend 契約 / test fixture を新 URL に合わせる
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

### Phase 3. 設定系を typed config へ統一

#### CFG-01 設定 namespace と typed config モデルを定義する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### CFG-02 起動時 validation / fail-fast を導入する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### CFG-03 `RuntimeConfigurationSupport` を縮退または削除する
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

#### CFG-04 `ORCAConnection` を singleton + custom.properties 依存から脱却させる
- [ ] 実施する
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
- 実施日時:
- 変更ファイル:
- 検証:
- メモ:

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
