# 01. Current State と判断ルール

この文書は、旧 `phase3_handoff_current_state.md` のうち、manager が最初に必要とする **current state / reopen ルール / release 境界** を整理したものです。

---

## 1. 基本原則

### 1-1. 正本
- **current repo が正本**
- repo に証拠がなければ **unknown**
- repo 外設定は、repo 内から推測しない
- partial snapshot による欠落は、そのまま defect と断定しない

### 1-2. レビュー方針
- 後方互換性はレビュー目標にしない
- legacy を残す理由が弱ければ、削除 / 縮小 / 単線化を優先する
- worktree の incidental な dirty state や artifact は repo truth の判定材料にしない

### 1-3. reopen ルール
閉じた論点は、次のどれかが **current repo に現れた時だけ** reopen します。

- active public/runtime path がまだ依存している
- tests / scripts が旧挙動を assert している
- config / docs が intended production contract と矛盾している
- safety / compliance / runtime evidence が不足し、release confidence を止めている

次だけでは reopen しません。

- 古いメモにそう書いてある
- 到達不能な legacy code が残っている
- dev-only 運用メモや環境依存メモがある
- repo 外設定がまだ入っていないだけ

---

## 2. 現在の結論

## 2-1. repo-local の実装フェーズ
**閉じています。**

この handoff 作成時点の repo-local truth は次です。

- static-analysis baseline burn-down は完了済み
- authoritative static-analysis entrypoint は 1 本化済み
- dedicated static-analysis PR workflow は restore 済み
- minimal release gate は docs に明記済み
- web / server / runtime smoke の主要 gate は local validation で green 扱い
- raw runtime error details の TRUE_REGRESSION は narrow patch で修正済み
- docs truth-sync は完了済み

## 2-2. merge / release 判定
- **repo-local では merge ready**
- ただし **release-ready ではない**
- release-ready までの残件は **repo-external manual task**

残っている repo-external manual task は大きく 2 つです。

1. GitHub branch protection / required checks の最終設定
2. production 用 external config / secrets の投入確認

## 2-3. repo-local code task
**none**

新しい cleanup wave は、current repo に新しい矛盾証拠が出るまで切りません。

---

## 3. manager が前提にしてよい repo-local truth

### 3-1. static-analysis policy
- SpotBugs / FindSecBugs は **fail-on-error のまま**
- Checkstyle / PMD は **skip のまま**
- static-analysis が green なのは gate 緩和ではなく、baseline を 0 まで焼いた結果

### 3-2. authoritative static-analysis entrypoint
正本は次の 1 本です。

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

補助入口:

```bash
bash ./scripts/server-modernized/verify-static-analysis.sh
```

wrapper は thin wrapper として扱います。

### 3-3. dedicated static-analysis workflow
`server-modernized-static-analysis-gate` は static-analysis 専用 workflow として restore 済みです。

manager が前提にしてよい内容:
- `pull_request` trigger あり
- `schedule` / `workflow_dispatch` 維持
- path filter は server 側関連に限定
- 実行内容は static-analysis 専用
- release-critical wrapper や reporting verify を混載しない

### 3-4. minimal release gate
release 前に必須とする最小セットはこの 3 本です。

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

補足:
- `runtime-ready-smoke.mjs` は **release 前 mandatory**
- ただし **every PR required** かどうかは repo 外設定次第なので、この資料では断定しません

---

## 4. 最新 known-good validation

handoff 時点の最新 known-good local validation として扱ってよいもの:

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

## 5. 今回の closeout で確定した重要変更

### 5-1. docs / workflow / static-analysis 側
- authoritative entrypoint を Maven 1 本に統一
- `verify-static-analysis.sh` を thin wrapper 化
- static-analysis PR workflow を restore
- minimal release gate を docs に明文化
- web-client の docs freeze / truth-sync を完了

### 5-2. runtime validation blocker 側
- runtime smoke を通すための blocker 修正は実施済み
- Web クライアントでは raw runtime error details の露出を narrow patch で除去済み

### 5-3. manager 観点の既知参照コミット
- `e348fe94f`: raw runtime error details 修正
- `5fd9c2a1c`: web-client notes truth-sync

---

## 6. close 扱いでよいもの

次は **current repo に矛盾証拠が出ない限り reopen しません**。

### 6-1. Phase2 系 reopen 禁止事項
- smoke patient 表示名 residual risk
- formal local summary route
- start-only transition
- pause / finish not being sent
- blocked legacy route zero-hit

### 6-2. frontend / runtime
- root-level legacy UI alias 縮小
- blocked ORCA route string guard の rename / scope 明確化
- `/api/orca/.../mock` の product runtime surface 除去
- stale legacy auth env / docs / QA scaffold cleanup
- admin `/api/admin/delivery` 二重面の解消
- `/api/admin/config` source of truth 化

### 6-3. server / public API surface
- public REST exposure の縮小
- blocked / legacy route の非露出担保
- chart-event の SSE 単線化
- old readiness / blocked outpatient / old local-medical route の reopen 不要

### 6-4. security / config / reporting
- `DOCUMENT_INTEGRITY_MODE=enforce`
- attachment storage は `s3` only
- `/tmp` / `user.home` fallback 排除
- trusted proxies は explicit 設定前提
- reporting は fail-closed 方針
- local preview は signing config なし前提

---

## 7. defer / unknown

### 7-1. defer
以下は現時点では active backlog ではありません。

- `setup-modernized-env.sh` の background `nohup npm run dev` が一部環境で即終了する理由の追跡
- Checkstyle / PMD の強制化
- `KarteServiceBean` / `KarteLegacyArtifactSupport` などの深い再分割

### 7-2. unknown
- GitHub 側の branch protection / required checks の現在設定
- `setup-modernized-env.sh` 背景起動が特定環境で即終了した原因
- repo-external secrets / config の投入状況

---

## 8. manager にとっての次の行動

### いま必要なこと
- repo-local を再編集することではありません
- **repo-external sign-off の回収**です

### 今の主タスク
1. GitHub required checks / branch protection の現物確認
2. production secrets / config の投入確認
3. Release owner に GO / NO-GO / PENDING を記録させる

### いま不要なこと
- 新しい Codex run を切ること
- UI backlog を release blocker として扱うこと
- docs-only の unknown を推測で埋めること

---

## 9. どんな時に repo-local へ戻るか

Codex に戻すのは、次のような **current repo mismatch** が出た時だけです。

- restore した workflow の check 名・path filter・job 構成が期待とズレていて YAML 修正が必要
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` が current repo で再現性を持って落ちる
- `cd web-client && npm run ci` が current repo で再現性を持って落ちる
- `cd web-client && node scripts/runtime-ready-smoke.mjs` が canonical な手順で再現性を持って落ちる
- current repo の code / tests / docs が reopen 条件を満たす regression を示す

逆に、次だけなら Codex に戻しません。

- branch protection がまだ更新されていない
- secrets / config が未投入
- GitHub 管理者やインフラ/運用担当の返答待ち
- release owner の sign-off 未記入
