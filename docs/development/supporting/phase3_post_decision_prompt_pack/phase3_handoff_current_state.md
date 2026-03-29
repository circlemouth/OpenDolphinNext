# OpenDolphinNext Phase3+ 現状引き継ぎメモ

最終更新: 2026-03-28

この文書は、`phase3_necessity_review_brief.md` と `phase3_decision_shared_context.md` を置き換えるための **単独で読める handoff** です。
以後の判断は **この文書 + 現在の repo 現物** だけで行ってください。

---

## 1. この文書の使い方

### 基本原則
- **current repo が正本**
- repo に証拠がなければ **`unknown`** と書く
- **後方互換性はレビュー目標ではない**
- legacy を残す理由が弱ければ、**削除 / 縮小 / 単線化** を優先する
- 過去の会話・handoff・ワーカーの作業ログは、**repo 現物と矛盾しない範囲でのみ補助情報** として扱う
- worktree の incidental な dirty state や未追跡 artifact は、repo truth の判定材料にしない

### reopen ルール
閉じた論点は、次のどれかが **current repo に現れた場合だけ** reopen してよい。
- active public/runtime path がまだ依存している
- tests / scripts が旧挙動を assert している
- config / docs が intended production contract と矛盾している
- safety / compliance / runtime evidence が不足し、release confidence を止めている

逆に、次だけでは reopen しない。
- 古いメモにそう書いてある
- 到達不能な legacy code が残っている
- dev-only 運用メモや環境依存メモがある

---

## 2. 現在の結論

### repo-local の実装フェーズ
**閉じています。**

現時点の repo-local truth は次です。
- static-analysis baseline burn-down は完了済み
- authoritative static-analysis entrypoint は 1 本化済み
- dedicated static-analysis PR workflow は restore 済み
- minimal release gate は repo-visible docs に明記済み
- web / server / runtime smoke の主要 gate はローカル検証で green

### merge / release 判定
**repo-local では merge ready** です。  
ただし、以下の **repo 外 manual task** は残ります。
- GitHub branch protection / required checks の最終設定
- 本番用 external config / secrets の投入

### 以前の「not ready」判定について
もし過去のメモに
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` が repo-only で green 判定できない
- verify-bound repo guard が snapshot 欠落で失敗する
- `.github/workflows/**` が見えず restore 状態を確認できない

といった記述があっても、それは **不完全 snapshot ベースの一時判定** です。  
**current repo で再現しない限り、現在は superseded 扱い** にしてください。

---

## 3. いま前提にしてよい current state

### 3.1 Phase2 系の reopen 禁止事項
以下は **current repo に矛盾証拠が出ない限り reopen しない**。
- smoke patient 表示名 residual risk
- formal local summary route
- start-only transition
- pause / finish not being sent
- blocked legacy route zero-hit

### 3.2 static-analysis policy
親側の方針は変わっていません。
- **SpotBugs / FindSecBugs は fail-on-error のまま**
- **Checkstyle / PMD は skip のまま**
- static-analysis を green にしたのは gate 緩和ではなく、**baseline を 0 まで焼いた結果**

### 3.3 authoritative static-analysis entrypoint
正本はこれです。

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

補助入口:

```bash
bash ./scripts/server-modernized/verify-static-analysis.sh
```

この wrapper は上の Maven command に委譲する **thin wrapper** として扱う。

### 3.4 dedicated static-analysis workflow
`server-modernized-static-analysis-gate` は **static-analysis 専用 workflow** として restore 済み。

前提として扱ってよい内容:
- `pull_request` trigger あり
- `schedule` / `workflow_dispatch` 維持
- path filter は server 側関連に限定
- 実行内容は static-analysis 専用
- release-critical wrapper や reporting verify、artifact upload などは混載しない

### 3.5 minimal release gate
release 前に必須とする最小セットは **この 3 本**。

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

補足:
- `runtime-ready-smoke.mjs` は **release 前 mandatory**
- ただし **毎 PR required** かどうかは repo 外設定次第なので、この文書だけで断定しない

---

## 4. 現在の contract / surface で閉じたとみなすもの

### 4.1 frontend / runtime
- root-level legacy UI alias 縮小は適用済み
- blocked ORCA route string guard は rename / scope 明確化済み
- `/api/orca/.../mock` の product runtime surface は除去済み
- stale legacy auth env / docs / QA scaffold cleanup は適用済み
- admin `/api/admin/delivery` 二重面は解消済みで、`/api/admin/config` が source of truth
- `fetchEffectiveAdminConfig()` 系の旧 contract は除去済み

### 4.2 server / public API surface
- public REST exposure は縮小済み
- blocked / legacy route は contract test 側で非露出を担保済み
- old readiness / blocked outpatient / old local-medical route は reopen 不要
- chart-event は SSE 単線へ寄せ済み
- dead ORCA / legacy stack は delete-first cleanup 済み

### 4.3 security / config / reporting
- `DOCUMENT_INTEGRITY_MODE=enforce`
- attachment storage は `s3` only
- `/tmp` / `user.home` fallback は production-like contract から排除
- trusted proxies は explicit 設定前提
- reporting README は **unsigned fallback ではなく fail-closed** の current contract に揃っている
- 署名は config が渡された場合にのみ実施、local preview は signing config なしで行う

### 4.4 static-analysis burn-down
Wave 1〜4 の burn-down は完了済み。
- SpotBugs / FindSecBugs total は **0**
- blanket suppression 追加なし
- failOnError / threshold / filter の弱体化なし

---

## 5. 最新 known-good validation

以下は handoff 時点の **最新 known-good local validation** として扱ってよい。

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && npm run ci
cd web-client && node scripts/runtime-ready-smoke.mjs
```

追加で通過済みとして扱ってよいもの:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=FreshSchemaBaselineTest,AdminOrcaUserLinkResourceTest,RestOrcaTransportTest -Dsurefire.failIfNoSpecifiedTests=false test
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaPatientSyncResourceTest -Dsurefire.failIfNoSpecifiedTests=false test
WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
```

runtime smoke artifact の既知出力先:
- `web-client/artifacts/webclient/runtime-gate-ready/<RUN_ID>`

---

## 6. 今回の closeout で入った重要修正

このフェーズ終盤では、workflow / docs だけでなく **runtime validation blocker** の是正も一緒に入っています。  
理由が分からなくなりやすいので、以下は覚えておくこと。

### 6.1 static-analysis / docs / workflow 側
- authoritative entrypoint を `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` に統一
- `scripts/server-modernized/verify-static-analysis.sh` を thin wrapper 化
- `server-modernized/pom.xml` の static-analysis profile を default-off 側に整理
- dedicated static-analysis PR workflow を restore
- minimal release gate を docs に明文化

### 6.2 runtime smoke を green にするための blocker 修正
- `AdminOrcaUserResource` / `AdminOrcaUserLinkResource` の `final` 除去
- `OrcaPatientSyncResource` を no-arg + field injection 対応へ変更
- `setup-modernized-env.sh` の health URL を `/openDolphin/api/health` に修正
- `setup-modernized-env.sh` の API health base を `/openDolphin` に修正

この 4 点は「余計な寄り道」ではなく、**release gate 実検証を通すための current repo 修正** として扱う。

---

## 7. これから残っているもの

### 7.1 repo-local code task
**none**

新しい cleanup wave は、**current repo に新しい矛盾証拠が出るまで切らない**。

### 7.2 repo-external manual task
以下は repo 内のコードではなく、外側の運用作業。

1. **branch protection / required checks の確認**
   - restore した static-analysis workflow の実際の check 名を確認する
   - それを required にするか決める
   - runtime smoke を毎 PR required にするかは別判断にする

2. **本番用 config / secrets の投入**
   - DB 接続情報 / DB CA
   - ORCA credential 保護鍵
   - 2FA AES 鍵
   - document integrity keyring
   - S3 bucket / credential
   - trusted proxies
   - 必要なら reporting signing keystore / TSA 設定

### 7.3 defer
- `setup-modernized-env.sh` の background `nohup npm run dev` が一部環境で即終了する理由の追跡
  - smoke 自体は明示起動した dev server 上で PASS しているため、現時点では closeout blocker ではない
- Checkstyle / PMD の強制化
  - current policy では未着手が正しい
- `KarteServiceBean` / `KarteLegacyArtifactSupport` などの深い再分割
  - 現時点では active backlog ではない

### 7.4 unknown
- GitHub 側の branch protection / required checks の現在設定
- `setup-modernized-env.sh` 背景起動が特定環境で即終了した原因

---

## 8. future reviewer / worker への指示

### 8.1 ChatGPT 向きの作業
- repo-only の再判定
- release readiness / mandatory gate / reopen 判定
- repo 外 manual task の整理
- current repo と docs の整合確認

### 8.2 Codex 向きの作業
次のいずれかが **current repo で実際に起きた時だけ**。
- restore した workflow の check 名・path filter・job 構成が期待とズレていて YAML 修正が必要
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` が再び current repo で落ちる
- `cd web-client && npm run ci` が current repo で落ちる
- `cd web-client && node scripts/runtime-ready-smoke.mjs` が canonical な手順で再現性を持って落ちる
- current repo の code / tests / docs が reopen 条件を満たす regression を示す

### 8.3 もし partial snapshot しか見えない場合
- root workflow や wrapper script、root module 実装が見えないなら、**regression と断定せず `unknown`** にする
- partial snapshot による欠落を、そのまま current repo の欠陥と混同しない
- ただし full repo で再確認して再現するなら reopen してよい

---

## 9. まず見るべきファイル

次のファイル群を current repo で優先確認する。

### root / gate
- `pom.server-modernized.xml`
- `.github/workflows/server-modernized-static-analysis-gate.yml`
- `scripts/server-modernized/verify-static-analysis.sh`
- `docs/DEVELOPMENT_STATUS.md`
- `docs/development/README.md`
- `docs/modernization/p9-05-static-analysis-gate.md`

### server
- `server-modernized/pom.xml`
- `server-modernized/config/server-modernized.env.sample`
- `server-modernized/config/attachment-storage.sample.yaml`
- `server-modernized/reporting/README.md`
- `docs/server-modernization/README.md`
- `docs/server-modernization/static-analysis-baseline-inventory.md`

### web
- `web-client/package.json`
- `web-client/scripts/runtime-ready-smoke.mjs`
- `web-client/scripts/verify-no-blocked-orca-route-strings.mjs`
- `web-client/scripts/verify-no-legacy-auth-drift.mjs`
- `web-client/notes/security-spec.md`
- `web-client/notes/auth-check.md`
- `setup-modernized-env.sh`

---

## 10. 判断を誤りやすいポイント

1. **runtime smoke は release 前 mandatory だが、毎 PR required とはまだ決めていない。**
2. **Checkstyle / PMD が skip なのは未完ではなく current policy。**
3. **古い not-ready メモは、不完全 snapshot ベースなら superseded 扱いにする。**
4. **dev-only の background 起動メモだけで reopen しない。**
5. **repo 外設定は current repo から推測しない。**
6. **新しい Phase3+ cleanup wave は、current repo の明示 regression が出るまで切らない。**

---

## 11. ひとことで言うと

**現在の Phase3+ は repo-local では closeout 済み。残るのは repo 外の運用確認だけ。**

次に何か作業を起こすなら、まずは
- required checks の現物確認
- production secrets / config 投入

を優先し、repo 内コードは **current repo が新しい矛盾を示した時だけ** 触る。
