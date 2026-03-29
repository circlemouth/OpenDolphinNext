# 06. Open Unknowns と evidence gaps

この文書は、**まだ確定していないこと** と、**それをどう確かめるか** を管理するための一覧です。  
unknown を無理に埋めないために使ってください。

---

## 1. repo-local unknown 一覧

| 論点 | なぜ unknown か | 影響 | 次に何を確認するか | 確認先候補 | 分類 |
| --- | --- | --- | --- | --- | --- |
| auth guard の screen-level 挙動 | docs は inventory だけで behavior を書いていない | back/redirect acceptance を固定できない | route×guard×trigger×landing | current repo guard 実装 / manual route walk | code-confirmation |
| route 別 minimal encounter context schema | docs は minimal keys までで止まっている | patient/encounter bar を fixed にできない | Charts / Patients / Mobile Images ごとの必要項目 | route / handoff 実装 | code-confirmation |
| Patients の入力 source 優先度 | patient-context docs が unknown と明記 | re-entry UX を推測で設計してしまう | source 一覧と優先度 | current repo 実装 / docs follow-up | code-confirmation |
| Mobile Images の入力 source 優先度 | docs が unknown と明記 | fallback copy の acceptance が曖昧 | source 一覧と優先度 | current repo 実装 / docs follow-up | code-confirmation |
| admin の current UI detail | ui docs が intentionally thin | IA 改善を画面詳細まで落とせない | section hierarchy / naming / sub-navigation | current repo 実装 / manual inventory | code-confirmation |
| auto-sync / auto-action の現況 | docs に記述がない | visibility/override 設計が空中戦になる | 発火条件、visible state、user control | current repo 実装 / walkthrough | code-confirmation |
| comparison / latest-follow の現況 | docs に契約がない | Charts 主従面設計の粒度が定まらない | 比較系 UI が主面か補助面か | current repo 実装 / current design notes | code-confirmation |
| `aria-live` / focus / keyboard rules | feedback-spec で unknown | a11y を後追い修正することになる | alert/badge/step-change の focus/live policy | docs follow-up / current repo 実装 | docs + code-confirmation |
| pane geometry / narrow layout order | ui docs が unknown と明記 | chart の読みやすさと mobile/narrow 設計が未固定 | narrow 時の stacking 優先順 | current repo 実装 / screenshot audit | code-confirmation |
| logout partial success の現 user-visible 表現 | security 原則はあるが copy 未固定 | auth-failure との誤認が残る | unsupported / failure 時の current copy | current repo 実装 / docs follow-up | docs + code-confirmation |

---

## 2. repo-external unknown 一覧

| 論点 | なぜ unknown か | release 影響 | 誰が確認するか | 確認先 |
| --- | --- | --- | --- | --- |
| GitHub required checks の current state | repo 外設定だから | 高 | GitHub 管理者 | branch protection 画面 / completed run |
| static-analysis actual check 名 | GitHub 上の実 run を見ないと確定しない | 高 | GitHub 管理者 | Actions completed run |
| web-client CI の actual check 名と required 状態 | repo 外設定だから | 高 | GitHub 管理者 | branch protection / completed run |
| `runtime-ready-smoke.mjs` を every PR required にするか | 運用判断だから | 高 | Release owner / GitHub 管理者 | sign-off 記録 |
| DB 接続情報 / DB CA の投入状況 | repo 外だから | 最高 | インフラ/運用 | Secret Manager / manifest / 起動ログ |
| ORCA credential 保護鍵 | repo 外だから | 最高 | インフラ/運用 / Security | secret 証跡 / 運用台帳 |
| 2FA AES 鍵 | repo 外だから | 最高 | インフラ/運用 / Security | secret 証跡 / 運用台帳 |
| document integrity keyring | repo 外だから | 最高 | インフラ/運用 | secret / mount / 起動ログ |
| S3 bucket / credential | repo 外だから | 最高 | インフラ/運用 | bucket 設定 / IAM / 疎通ログ |
| trusted proxies | repo 外だから | 高 | インフラ/運用 | Ingress/LB 設定 / アプリ設定 |
| reporting signing keystore / TSA | release scope 依存だから | 条件付き高 | インフラ/運用 / Release owner | 決定メモ / 設定証跡 |

---

## 3. unknown を埋める時の注意

### 3-1. これは証拠にならない
- 古いメモに書いてある
- 別ブランチで見た
- partial snapshot に無い
- dev-only の挙動だった
- 以前そうだった気がする
- UI 改善の提案としては自然

### 3-2. これは証拠になる
- current repo の code / tests / docs / scripts / workflow
- GitHub の current settings 画面
- Actions の completed run
- production secrets/config の証跡
- current contract と矛盾する再現ログ

---

## 4. unknown を閉じる順番

### まず閉じるべきもの
1. GitHub required checks
2. production secrets / config
3. auth guard / redirect matrix
4. Patients / Mobile Images / Administration の inventory
5. a11y / keyboard / narrow layout の最小契約

### 後でもよいもの
- comparison / latest-follow の詳細
- pane geometry の細部
- logout partial success の見た目差
- `clientUuid` の説明詳細

---

## 5. manager への指示

unknown を見つけた時は、すぐ実装タスクにしないでください。  
必ず次の順で処理します。

1. unknown をこの表に載せる
2. repo-local か repo-external か分ける
3. 証拠取りの担当を決める
4. 証拠が出てから `MATCH / DOCS_UNDER_SPEC / DOCS_OVER_ASSERT / TRUE_REGRESSION / REPO_EXTERNAL_ONLY` に分類する

---

## 6. この段階で intentionally 残す unknown

この handoff 作成時点では、次は intentionally unknown のままで構いません。

- Patients / Mobile Images の detail UI
- Administration の detail UI
- a11y の細則
- pane geometry の細部
- `runtime-ready-smoke.mjs` の screen-level coverage 詳細
- `setup-modernized-env.sh` 背景起動問題の原因

### 理由
これらは current contract の根幹ではなく、まず repo-external sign-off を閉じる方が優先だからです。
