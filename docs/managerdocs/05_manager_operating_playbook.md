# 05. Manager Operating Playbook

この文書は、次の manager が **新しい報告をどうさばくか** を決めるための実務手順書です。

---

## 1. まず守る境界

### 1-1. repo-local と repo-external を混線させない
- repo-local: current repo の code / docs / tests / scripts / workflow
- repo-external: GitHub settings、required checks の設定、production secrets / config、運用証跡

### 1-2. reopen の条件
repo-local に戻すのは、**current repo mismatch** がある時だけです。  
repo 外の確認不足や未投入だけでは reopen しません。

### 1-3. unknown を勝手に埋めない
- docs にない route を作らない
- UI 詳細を推測で埋めない
- repo 外設定を repo から断定しない

---

## 2. だれに何を頼むか

| 状況 | 担当 | 依頼内容 |
| --- | --- | --- |
| GitHub required checks / branch protection の現況を知りたい | 人間（GitHub 管理者） | required checks 一覧、actual check 名、required yes/no、stale check 名の有無 |
| production secrets / config の現況を知りたい | 人間（インフラ/運用） | yes/no/unknown と投入先、証跡種別の回収 |
| repo-local の state を再整理したい | ChatGPT | repo-only の再判定、release readiness、manual task の整理、docs 整合確認 |
| repo mismatch を修正したい | Codex | workflow / gate / docs-code mismatch の修正 |
| UI backlog を整理したい | ChatGPT | 非 blocking backlog の優先順位化、工程整理 |
| UI の code-confirmation を取りたい | Codex | guard behavior、source priority、auto-sync 現況などの確認 |

---

## 3. 新しい報告を受けた時の処理手順

### Step 1. まず分類する
その報告が次のどれかを決めます。

1. **MATCH**  
   現行 docs / repo と整合
2. **DOCS_UNDER_SPEC**  
   repo の方が具体だが docs が薄い
3. **DOCS_OVER_ASSERT**  
   docs が言い過ぎていて repo が追随していない
4. **TRUE_REGRESSION**  
   current contract と current repo が本当にズレている
5. **REPO_EXTERNAL_ONLY**  
   GitHub settings や secrets など repo 外でしか確定できない
6. **UNKNOWN**  
   証拠不足で判定できない

### Step 2. 次の担当を決める
- `MATCH` → close
- `DOCS_UNDER_SPEC` / `DOCS_OVER_ASSERT` → docs follow-up backlog
- `TRUE_REGRESSION` → Codex
- `REPO_EXTERNAL_ONLY` → 人間
- `UNKNOWN` → `06_open_unknowns_and_evidence_gaps.md` に載せて証拠取りへ

### Step 3. 影響度を決める
- P0: release blocker になり得る
- P1: 早めに直したいが release blocker ではない
- P2: 将来 backlog でよい

---

## 4. ChatGPT / Codex / 人手の使い分け

## 4-1. ChatGPT 向き
- repo-only の再判定
- release readiness / mandatory gate / reopen 判定
- repo 外 manual task の整理
- current repo と docs の整合確認
- UI バックログの優先順位整理
- 依頼文や sign-off 文面の作成

## 4-2. Codex 向き
次のどれかが current repo で **実際に起きた時だけ**。

- workflow の check 名・path filter・job 構成が期待とズレている
- Maven static-analysis verify が再現性を持って落ちる
- `npm run ci` が再現性を持って落ちる
- `runtime-ready-smoke.mjs` が canonical 手順で再現性を持って落ちる
- current repo の code / tests / docs が reopen 条件を満たす regression を示す
- code-confirmation が必要な unknown を潰す

## 4-3. 人手で閉じるもの
- GitHub required checks の設定
- branch protection の最終設定
- production secrets / config の投入
- keystore / TSA / bucket / trusted proxies の運用準備
- sign-off 記録の入力

---

## 5. 週次の manager routine

### 毎週最初に確認
1. repo-external の yes/no/unknown が増減したか
2. GO / NO-GO / PENDING が更新されたか
3. repo mismatch の証拠が新しく出たか
4. UI backlog に release blocker が混ざっていないか

### 毎週の進め方
- 火曜までに GitHub / インフラの回答を回収
- 水曜に GO / NO-GO / PENDING を更新
- 木曜に UI backlog の quick win と code-confirmation を整理
- 金曜に「人手で閉じるもの」と「Codex に戻すもの」を分ける

---

## 6. manager が守るべき禁止事項

- repo-external の未確認を repo defect と見なす
- 旧 handoff や古いメモだけで reopen する
- partial snapshot の欠落を defect と断定する
- `runtime-ready-smoke.mjs` を every PR required と勝手に決める
- `/api/admin/delivery` を第 2 正本として復活させる
- patient context の永続化を安全策として持ち込む
- debug-only surface を normal runtime の主面に昇格させる

---

## 7. manager の判断テンプレ

新しい報告を受けたら、最低限この 5 行を埋めてください。

- 分類: `MATCH / DOCS_UNDER_SPEC / DOCS_OVER_ASSERT / TRUE_REGRESSION / REPO_EXTERNAL_ONLY / UNKNOWN`
- 影響度: `P0 / P1 / P2`
- repo-local か repo-external か:
- 次の担当: `人間 / ChatGPT / Codex`
- いつ閉じるか:

---

## 8. manager が今すぐやるべきこと

1. `07_communication_templates.md` の文面を送る
2. `02_release_readiness_and_repo_external_signoff.md` の表を埋める
3. `04_ui_improvement_program.md` の BL-01 / BL-05 / BL-02 / BL-03 を quick win 候補として backlog 化する
4. repo mismatch の証拠が出るまで、新しい repo-local cleanup wave を切らない
