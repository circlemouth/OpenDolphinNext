# server-modernized 残件クローズ実装チェックリスト

> Legacy/Archive。完遂済みのため、現行の進捗判定や次作業決定には使用しない。最新の開発計画は `dangerous-path-remediation-execution-checklist.md` を参照する。

作成日: 2026-03-22  
対象リポジトリ: `circlemouth/OpenDolphinNext` の `server-modernized`  
配置先: `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remaining-closure-checklist-20260322.md`

## 0-a. 参照パスの読み方

- 本書中の `docs/contracts/...` / `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md` / `docs/runbooks/...` は、`docs/server-modernization/planning/server-modernized-plan/docs/` 配下を指す。
- `docs/DEVELOPMENT_STATUS.md` と `docs/DEVELOPMENT_STATUS.md` は、リポジトリ直下 `docs/` 配下の現行運用ログ/総合ステータスを指す。
- 迷った場合は、まず `docs/server-modernization/planning/server-modernized-plan/README.md`、次に `docs/server-modernization/planning/server-modernized-plan/docs/README.md` を読む。

---

## 0. この文書の目的

この文書は、`server-modernized` の改修計画本体がほぼ完了したあとに残っている **実装上の取りこぼし** と **ガードの甘さ** だけを、担当者がそのまま手を動かして閉じるための最終チェックリストである。

この文書は、新しい大規模設計を始めるためのものではない。やることは次の 3 つに限定する。

1. runtime config 境界を**契約どおりに厳密化**する
2. generated artifact ガードを**実効性のある形に強化**する
3. 最終自己監査・文書同期・レビュー用 clean archive の作り方を**再現可能な手順に固定**する

---

## 1. この文書の使い方

- [ ] 先に `docs/server-modernization/planning/server-modernized-plan/docs/README.md` を読む
- [ ] 先に `docs/server-modernization/planning/server-modernized-plan/docs/contracts/runtime-config.md` を読む
- [ ] 先に `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md` を読む
- [ ] 先に `docs/DEVELOPMENT_STATUS.md` を読む
- [ ] 先に `docs/server-modernization/planning/server-modernized-plan/docs/runbooks/release-validation.md` を読む
- [ ] この文書の **RC-01 → RC-02 → RC-03** の順で進める
- [ ] 各 RC は **コード / docs / tests / verify 結果** を同じ PR にまとめる
- [ ] 各 RC 完了後に `docs/DEVELOPMENT_STATUS.md` を更新する
- [ ] 各 RC 完了後に `mvn -f pom.server-modernized.xml -pl server-modernized -am clean verify` を実行する

**禁止事項**

- [ ] `docs/server-modernization/planning/**` の参照用計画資料だけ更新して終えない
- [ ] `System.getenv` / `System.getProperty` / `ConfigProvider.getConfig()` の新規直読みを増やさない
- [ ] allowlist を広げて CI を通すだけの修正をしない
- [ ] 生成物混入を「提出時に気をつける」で済ませない
- [ ] WS-02〜WS-08 の完了済み項目を理由なくやり直さない

---

## 2. 今回の残件サマリ

### 今回閉じるべき残件

- [ ] **RC-01** runtime config 境界の strict closure
- [ ] **RC-02** generated artifact guard の hardening
- [ ] **RC-03** 最終自己監査・文書同期・clean archive 手順の固定

### 今回は reopen しないもの

以下は既存 docs / execution log で完了済みとして扱う。**この文書では触らない。**

- [ ] health / readiness の大枠設計変更
- [ ] ORCA secret protector 分離の再設計
- [ ] document integrity keyring 化の再設計
- [ ] patient images の temp-file upload / context-root 非依存 URL の再設計
- [ ] runtime DDL 除去のやり直し
- [ ] ORCA Master API `scope` 仕様の再議論
- [ ] 大型クラス分割の追加着手

### 今回は backlog 扱いにするもの

- [ ] SpotBugs の `Unsupported class file major version 69` 解消
  - 今回の最終クローズ作業とは分離する
  - 別 PR / 別チケットで扱う
  - ただし `docs/DEVELOPMENT_STATUS.md` には deferred として明記する

---

## 3. PR 分割（この順番で切ること）

- [ ] **PR-A / RC-01** runtime config strict closure
- [ ] **PR-B / RC-02** generated artifact guard hardening
- [ ] **PR-C / RC-03** final closure audit + clean archive runbook
- [ ] **PR-D / optional** SpotBugs toolchain cleanup（必要な場合のみ）

---

## 4. RC-01 Runtime Config 境界 strict closure

### 4-1. 目的

`docs/contracts/runtime-config.md` に書いてある「`ServerConfigurationResolver` を唯一の境界にする」「旧 property / 旧 env / fallback を削除する」という契約と、現在の実装・CI ガードのズレをなくす。

### 4-2. この RC の完了条件

以下をすべて満たしたら完了。

- [ ] `server-modernized/src/main/java` で `System.getenv` / `System.getProperty` / `ConfigProvider.getConfig()` を検索したとき、**許可対象が `ServerConfigurationResolver.java` だけ**になる
- [ ] `ServerConfigurationResolver` の中から **raw な `System.getProperty` / `System.getenv` fallback** が消える
- [ ] `RuntimeConfigurationSupport` から **legacy property 名** と **設定解決責務** が消える
- [ ] `check-no-direct-runtime-lookup.sh` の allowlist が **縮小** される
- [ ] `docs/contracts/runtime-config.md` と実装と CI ガードが一致する
- [ ] `mvn ... clean verify` が通る

### 4-3. 対象ファイル

#### 必須で編集するファイル

- [ ] `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- [ ] `server-modernized/src/main/java/open/dolphin/runtime/RuntimeConfigurationSupport.java`
- [ ] `server-modernized/tools/ci/check-no-direct-runtime-lookup.sh`
- [ ] `server-modernized/src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
- [ ] `server-modernized/src/test/java/open/dolphin/tools/ci/RepoGuardScriptsIT.java`
- [ ] `docs/contracts/runtime-config.md`
- [ ] `docs/DEVELOPMENT_STATUS.md`
- [ ] `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md`

#### allowlist を縮めた後に違反が出た場合だけ編集する候補ファイル

次のファイルは、**最初から触るのではなく**、allowlist を縮めたあとで `check-no-direct-runtime-lookup.sh` が落ちた場合だけ修正対象にする。

- [ ] `server-modernized/src/main/java/open/orca/rest/OrcaResource.java`
- [ ] `server-modernized/src/main/java/open/dolphin/session/SystemServiceBean.java`
- [ ] `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java`
- [ ] `server-modernized/src/main/java/open/dolphin/session/SessionMessageHandler.java`
- [ ] `server-modernized/src/main/java/open/dolphin/mbean/ServletStartup.java`
- [ ] `server-modernized/src/main/java/open/dolphin/mbean/PvtService.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/OrcaApiProxySupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigStore.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/masterupdate/MasterUpdateScheduler.java`

### 4-4. 事前確認コマンド

repo root で実行し、結果を作業メモに貼る。

```bash
rg 'System\.get(env|Property)|ConfigProvider\.getConfig\(' server-modernized/src/main/java -n
```

```bash
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
```

```bash
rg 'dolphin\.facilityId' server-modernized -n -g '!docs/server-modernization/planning/**'
```

### 4-5. 実装手順

#### A. CI ガードを先に厳しくする

- [ ] `check-no-direct-runtime-lookup.sh` の `allowed_files` を見直す
- [ ] まず **`ServerConfigurationResolver.java` だけを残す** 方針で編集する
- [ ] 下記ファイルを allowlist から削除する
  - [ ] `RuntimeConfigurationSupport.java`
  - [ ] `OrcaResource.java`
  - [ ] `SystemServiceBean.java`
  - [ ] `ChartEventServiceBean.java`
  - [ ] `SessionMessageHandler.java`
  - [ ] `ServletStartup.java`
  - [ ] `PvtService.java`
  - [ ] `AbstractResource.java`
  - [ ] `OrcaApiProxySupport.java`
  - [ ] `AdminConfigStore.java`
  - [ ] `MasterUpdateScheduler.java`
- [ ] allowlist を縮めた状態で一度スクリプトを実行し、offender 一覧を採取する
- [ ] **allowlist を広げ直さない**

#### B. `ServerConfigurationResolver` の raw fallback を削除する

- [ ] `ServerConfigurationResolver` 内の `System.getProperty(key)` を削除する
- [ ] `ServerConfigurationResolver` 内の `System.getenv(key)` を削除する
- [ ] `optional(String key)` / `raw(String key)` 系メソッドは、次の順序だけにする
  1. [ ] test 用 overrides
  2. [ ] `ConfigProvider.getConfig()` 由来の typed/optional 取得
  3. [ ] 取得できなければ `Optional.empty()` or `null`
- [ ] 「raw Java property/env fallback がなくても既存テストが通る」ことを確認する

#### C. `RuntimeConfigurationSupport` を pure utility に縮退させる

- [ ] `RuntimeConfigurationSupport` に legacy key 名が残っていないか確認する
- [ ] `PROP_FACILITY_ID = "dolphin.facilityId"` を削除する
- [ ] もし key-name 定数が他にも残っていて、pure utility ではなく契約知識を持っているなら、`ServerConfigurationResolver` 側へ寄せるか削除する
- [ ] `RuntimeConfigurationSupport` には **I/O を伴わない pure utility** だけを残す
  - [ ] 文字列正規化
  - [ ] production-like 判定
  - [ ] 数値/真偽値の pure parser
- [ ] もし `RuntimeConfigurationSupport` が設定解決をしているコードが残っていたら削除する

#### D. allowlist 縮小後に落ちた production code を 1 ファイルずつ潰す

`check-no-direct-runtime-lookup.sh` が落ちたら、**落ちたファイルだけ** 次の手順で直す。

- [ ] offender ファイルで `System.getenv` / `System.getProperty` / `ConfigProvider.getConfig()` を特定する
- [ ] その値が runtime contract に属するなら `ServerRuntimeConfiguration` に型を追加する
- [ ] `ServerConfigurationResolver` に解決ロジックを追加する
- [ ] 必要なら `ServerConfigurationValidator` に検証を追加する
- [ ] offender ファイル側は、resolver 由来の typed 値を受け取るように書き換える
- [ ] direct call を削除する
- [ ] 同じ PR で `docs/contracts/runtime-config.md` を更新する

#### E. テストを追加・更新する

- [ ] `ServerConfigurationResolverTest` に次を追加する
  - [ ] system property を一時セットしても resolver がそれを raw fallback として使わないこと
  - [ ] override / config / Optional.empty の優先順が固定されること
- [ ] `RepoGuardScriptsIT` を更新し、`check-no-direct-runtime-lookup.sh` が縮小 allowlist でも成功することを確認する
- [ ] offender を修正した場合は、そのクラスの既存テストまたは characterization test を追加する

#### F. 文書を同期する

- [ ] `docs/contracts/runtime-config.md` の実装ルールと受け入れ条件を **現実に一致する表現** に更新する
- [ ] `docs/DEVELOPMENT_STATUS.md` に `RC-01 Runtime Config strict closure` の項を追加する
- [ ] `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md` に追補 or 完了メモを追加する

### 4-6. 完了判定コマンド

```bash
rg 'System\.get(env|Property)|ConfigProvider\.getConfig\(' server-modernized/src/main/java -n
```
期待値:
- `ServerConfigurationResolver.java` 以外 0 件
- 可能なら resolver 内も `ConfigProvider.getConfig()` だけに収束

```bash
rg 'dolphin\.facilityId' server-modernized -n -g '!docs/server-modernization/planning/**'
```
期待値:
- production code / docs / sample env に 0 件

```bash
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
```
期待値:
- 成功

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am clean verify
```
期待値:
- 成功

---

## 5. RC-02 Generated Artifact Guard Hardening

### 5-1. 目的

`target/`, `*.war`, `__MACOSX`, `.DS_Store` などの提出不要物が、**git status が clean でも** ガードに引っかかる状態にする。レビュー ZIP 汚染を「人が気をつける」ではなく CI で止める。

### 5-2. この RC の完了条件

- [ ] `check-no-generated-artifacts.sh` が **tracked file** も **untracked file** も検出する
- [ ] `target/`, `*.war`, `__MACOSX`, `.DS_Store`, `Thumbs.db` を検出対象にする
- [ ] `RepoGuardScriptsIT` に「clean status でも committed offender を検出する」ケースが入る
- [ ] `docs/runbooks/release-validation.md` に clean archive の作り方が書かれる
- [ ] `mvn ... clean verify` が通る

### 5-3. 対象ファイル

- [ ] `server-modernized/tools/ci/check-no-generated-artifacts.sh`
- [ ] `server-modernized/src/test/java/open/dolphin/tools/ci/RepoGuardScriptsIT.java`
- [ ] `server-modernized/pom.xml`（必要な場合のみ）
- [ ] `docs/runbooks/release-validation.md`
- [ ] `docs/DEVELOPMENT_STATUS.md`
- [ ] `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md`

### 5-4. 事前確認コマンド

```bash
bash server-modernized/tools/ci/check-no-generated-artifacts.sh --root "$(git rev-parse --show-toplevel)"
```

```bash
git ls-files | rg '(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$' || true
```

```bash
git ls-files --others --exclude-standard | rg '(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$' || true
```

### 5-5. 実装手順

#### A. スクリプトの検出対象を強化する

- [ ] `check-no-generated-artifacts.sh` の git repo 分岐を修正する
- [ ] 既存の `git status --porcelain` 依存をやめる
- [ ] git repo 内では次の両方を合成して検査する
  - [ ] `git ls-files`
  - [ ] `git ls-files --others --exclude-standard`
- [ ] 非 git 環境では `find` フォールバックを維持する
- [ ] 検出対象 regex を次に拡張する
  - [ ] `(^|/)target(/|$)`
  - [ ] `\.war$`
  - [ ] `(^|/)__MACOSX(/|$)`
  - [ ] `(^|/)\.DS_Store$`
  - [ ] `(^|/)Thumbs\.db$`
- [ ] 出力は `sort -u` で重複除去する

#### B. 期待するスクリプト構造

次のような考え方で組み直す。

```bash
if git rev-parse --git-dir >/dev/null 2>&1; then
  offenders=$(
    {
      git ls-files -z
      git ls-files --others --exclude-standard -z
    } |
      tr '\0' '\n' |
      rg '(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$' |
      sort -u || true
  )
else
  offenders=$(
    find . -type f \(
      -path '*/target/*' -o
      -name '*.war' -o
      -path '*/__MACOSX/*' -o
      -name '.DS_Store' -o
      -name 'Thumbs.db'
    \) -print | sed 's#^\./##' | sort -u || true
  )
fi
```

**重要**

- [ ] 例外リストを新設しない
- [ ] committed 済み生成物があっても fail することを優先する

#### C. `RepoGuardScriptsIT` を強化する

既存の「今の repo で成功する」確認だけでは不十分。**汚染 repo fixture を意図的に作って fail させるテスト**を追加する。

追加するケース:

- [ ] case-1: clean な temp git repo に `server-modernized/target/tmp.txt` を **commit** し、script が fail する
- [ ] case-2: clean な temp git repo に `artifacts/review.war` を **commit** し、script が fail する
- [ ] case-3: clean な temp git repo に `__MACOSX/a/b.txt` を **commit** し、script が fail する
- [ ] case-4: clean な temp git repo に `.DS_Store` を **commit** し、script が fail する
- [ ] case-5: clean repo では success する

実装ルール:

- [ ] temp repo を JUnit 側で生成する
- [ ] `git init` → `git add` → `git commit` まで行い、**status clean** を再現する
- [ ] script 実行は実際の bash script を subprocess で呼ぶ
- [ ] fail case では標準エラーに offending path が出ることも検証する

#### D. runbook を更新する

`docs/runbooks/release-validation.md` に **review/release archive 作成手順** を追加する。

必ず書くこと:

- [ ] archive は repo root から作る
- [ ] `git archive` を第一候補にする
- [ ] zip を手動作成する場合の禁止対象を明記する
- [ ] archive 後に `zipinfo -1` で禁止パターンを grep する

runbook に追加するコマンド例:

```bash
git archive --format=zip --output /tmp/OpenDolphinNext-clean.zip HEAD
```

```bash
zipinfo -1 /tmp/OpenDolphinNext-clean.zip | \
  rg '(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$' && exit 1 || true
```

#### E. 文書を同期する

- [ ] `docs/DEVELOPMENT_STATUS.md` に `RC-02 Generated Artifact Guard Hardening` の項を追加する
- [ ] `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md` に追補 or 完了メモを追加する

### 5-6. 完了判定コマンド

```bash
bash server-modernized/tools/ci/check-no-generated-artifacts.sh --root "$(git rev-parse --show-toplevel)"
```
期待値:
- clean repo では成功

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am clean verify
```
期待値:
- `RepoGuardScriptsIT` を含めて成功

---

## 6. RC-03 Final Closure Audit / Handoff / Clean Archive

### 6-1. 目的

「直した」ではなく「検証済み・文書同期済み・提出物も clean」と言い切れる状態にする。

### 6-2. この RC の完了条件

- [ ] runtime-config strict closure の証跡が docs に残る
- [ ] generated artifact guard hardening の証跡が docs に残る
- [ ] master checklist / execution log / runbook が最新化される
- [ ] clean archive の作成手順が runbook どおり再現できる
- [ ] clean archive を実際に 1 回作り、禁止ファイルが含まれないことを確認する

### 6-3. 対象ファイル

- [ ] `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md`
- [ ] `docs/DEVELOPMENT_STATUS.md`
- [ ] `docs/runbooks/release-validation.md`
- [ ] `docs/DEVELOPMENT_STATUS.md`（必要なら「残件クローズ完了」を追記）
- [ ] `README.md`（必要なら docs への導線を最小更新）

### 6-4. 実施手順

#### A. フル verify を回す

repo root で実行する。

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am clean verify
```

- [ ] BUILD SUCCESS を確認する
- [ ] 実行日時を控える
- [ ] 実行コマンドを execution log に貼る

#### B. 追加の手動監査コマンドを回す

```bash
rg 'System\.get(env|Property)|ConfigProvider\.getConfig\(' server-modernized/src/main/java -n
```

```bash
rg 'dolphin\.facilityId' server-modernized -n -g '!docs/server-modernization/planning/**'
```

```bash
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
```

```bash
bash server-modernized/tools/ci/check-no-generated-artifacts.sh --root "$(git rev-parse --show-toplevel)"
```

- [ ] 4 本すべての結果を execution log に記録する

#### C. clean archive を実際に作る

```bash
git archive --format=zip --output /tmp/OpenDolphinNext-clean.zip HEAD
```

```bash
zipinfo -1 /tmp/OpenDolphinNext-clean.zip | \
  rg '(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$' && exit 1 || true
```

- [ ] ZIP 作成に成功する
- [ ] 禁止パターン 0 件を確認する
- [ ] 結果を execution log に記録する

#### D. 文書を閉じる

- [ ] `docs/DEVELOPMENT_STATUS.md` に `RC-03 Final Closure Audit` の項を追加する
- [ ] `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md` に「残件クローズ完了」追補を追加する
- [ ] `docs/runbooks/release-validation.md` を最終手順に合わせて更新する
- [ ] `docs/DEVELOPMENT_STATUS.md` が現行運用上の入口として使われている場合は、closure 状態を一文だけ追記する

### 6-5. レビュー時に提出する証跡

- [ ] `mvn ... clean verify` の成功ログ（時刻付き）
- [ ] runtime-config grep の結果
- [ ] `check-no-direct-runtime-lookup.sh` 成功ログ
- [ ] `check-no-generated-artifacts.sh` 成功ログ
- [ ] clean archive の `zipinfo -1` 検査結果
- [ ] 変更ファイル一覧

---

## 7. optional RC-04 SpotBugs toolchain cleanup（今やらないなら backlog 明記のみ）

### 7-1. これは今すぐ必須ではない

ただし、execution log に既知の未解決事項として残っている場合は、次のどちらかを必ず行う。

- [ ] この RC を別 ticket / issue / WBS に切り出す
- [ ] もしくは今回の execution log に deferred として残し、closure の対象外であることを明記する

### 7-2. もし今やるなら最低限の手順

- [ ] `server-modernized/pom.xml` で SpotBugs 実行条件を確認する
- [ ] 使用 JDK / target bytecode / SpotBugs plugin version の組み合わせを整理する
- [ ] Java 69 非対応が plugin 側の問題なら plugin 更新可否を確認する
- [ ] plugin 更新で難しい場合は toolchains で SpotBugs 実行 JDK を固定する案を検証する
- [ ] `spotbugs.skip=true` を既定で残すか外すかを docs に明記する

**この RC を今やらない場合の完了条件**

- [ ] `docs/DEVELOPMENT_STATUS.md` に deferred 理由が残っている
- [ ] `docs/DEVELOPMENT_STATUS.md` または相応のトラッキング場所に未完了理由が記録されている

---

## 8. 最終チェックボックス（担当者用）

### RC-01

- [ ] allowlist を縮めた
- [ ] resolver の raw property/env fallback を消した
- [ ] `dolphin.facilityId` を production tree から消した
- [ ] runtime-config 契約文書を同期した
- [ ] verify を通した

### RC-02

- [ ] generated-artifact guard が tracked/untracked 両方を検出する
- [ ] `__MACOSX` / `.DS_Store` / `Thumbs.db` も検出する
- [ ] RepoGuardScriptsIT に committed-offender fail case を入れた
- [ ] release runbook に clean archive 手順を書いた
- [ ] verify を通した

### RC-03

- [ ] full verify 成功を記録した
- [ ] 手動監査コマンド 4 本を記録した
- [ ] clean archive を 1 回作って検査した
- [ ] master checklist を閉じた
- [ ] execution log を閉じた

### optional RC-04

- [ ] SpotBugs を直した、または deferred を明記した

---

## 9. 完了報告テンプレート

担当者は最終的に、次の形で報告すること。

```text
件名: server-modernized 残件クローズ完了

1. 完了した RC
- RC-01: 完了
- RC-02: 完了
- RC-03: 完了
- RC-04: deferred / 完了

2. verify
- 実行コマンド:
- 実行日時:
- 結果:

3. 手動監査
- direct runtime lookup:
- legacy facility key:
- generated artifact guard:
- clean archive check:

4. 更新ファイル
- コード:
- docs:
- tests:

5. 未解決事項
- なし / あり（内容）
```
