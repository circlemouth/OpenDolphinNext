# 06. Open Unknowns と evidence gaps

この文書は、**まだ確定していないこと** と、**それをどう確かめるか** を管理するための一覧です。  
unknown を無理に埋めないために使ってください。

---

## 1. repo-local unknown 一覧

| 論点 | なぜ unknown か | 影響 | 次に何を確認するか | 確認先候補 | 分類 |
| --- | --- | --- | --- | --- | --- |
| auth guard の task-specific coverage 差分 | task-oriented matrix の主要行は code-confirm できたが、`screenKey` 粒度外の direct navigate / browser history 差分は未整理 | unsaved-change / task resume acceptance の端を固定できない | screenKey 直外の遷移経路 | current repo guard 実装 / manual route walk | code-confirmation |
| route 別 minimal encounter context の app-wide schema | Charts / Patients / Mobile Images の minimal schema は docs 昇格済みだが、print / admin / debug を含む全体 schema は未定義 | patient/encounter bar を app-wide fixed にできない | 非主面ルートで必要な handoff keys | route / handoff 実装 | code-confirmation |
| auto-sync / auto-action の cross-surface policy | surface 別 inventory は取れたが、visibility / override を横断で固定する証拠がない | policy を推測で新設してしまう | 共通 visibility / override contract の有無 | current repo 実装 / walkthrough | code-confirmation |
| app-wide `aria-live` / focus / keyboard rules | touched surface の minimum は docs 化したが、app-wide 細則は未固定 | a11y を横断設計で誤って固定する | 非対象 surface の focus/live policy | docs follow-up / current repo 実装 | docs + code-confirmation |
| pane geometry / narrow layout order | ui docs が unknown と明記 | chart の読みやすさと mobile/narrow 設計が未固定 | narrow 時の stacking 優先順 | current repo 実装 / screenshot audit | code-confirmation |
| logout partial success の現 user-visible 表現 | security 原則はあるが copy 未固定 | auth-failure との誤認が残る | unsupported / failure 時の current copy | current repo 実装 / docs follow-up | docs + code-confirmation |

### 1-1. この周回で unknown から外したもの

- comparison / latest-follow の current behavior:
  normal runtime 主面は `SoapNotePanel`、補助 surface は `PastHubPanel` と `ChartsActionBar` の再読込系、`DocumentTimeline` と `MedicalOutpatientRecordPanel` は debug-only まで code-confirm 済み。
- active runtime の raw-detail inventory:
  `PatientsPage`、`ChartsActionBar`、`ReceptionPage` の action/result feedback は current repo で canonical copy に同期済み。残る `ChartsPage` order-set notice、`ReceptionPage` search/master notice、administration operator surface は backlog であり、unknown ではなく residual regression inventory として扱う。

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
3. auth guard の task-specific coverage 差分
4. auto-sync / auto-action の cross-surface policy
5. a11y / keyboard / narrow layout の app-wide 追加証拠

### 後でもよいもの
- comparison / latest-follow の将来 IA
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

- comparison / latest-follow の将来 IA
- auto-sync / auto-action の cross-surface policy
- a11y の app-wide 細則
- pane geometry の細部
- task-specific guard coverage 差分
- `runtime-ready-smoke.mjs` の screen-level coverage 詳細
- `setup-modernized-env.sh` 背景起動問題の原因

### 理由
これらは current contract の根幹ではなく、まず repo-external sign-off を閉じる方が優先だからです。
